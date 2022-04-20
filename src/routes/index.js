const shop_routes = require('./shop')
const blogs_router = require('./blogs')
const pool = require('./db');
const path = require('path');
const bodyParser = require('body-parser');
const JSAlert = require("js-alert");
const bcrypt = require('bcrypt');
const session = require('express-session');
const flash = require('express-flash');
const passport = require("passport");
const upload = require('./uploadMiddleware');
const Resize = require('./Resize');
const foods_controller = require('../app/controllers/foods')

// const initiablizePassport = require("./passportConfig"); 
const e = require('express');
const { type } = require('os');
const { get } = require('http');
// initiablizePassport(passport);

// create application/x-www-form-urlencoded parser
var urlencodedParser = bodyParser.urlencoded({ extended: false })


async function route(app){
    //thiết lập session
    app.use(session({
        secret: 'secrect',
        resave: true,
        saveUninitialized: true,
        cookie: { maxAge: 60000000 }
    }));

    //route trang chủ
    app.get('/', urlencodedParser, async (req, res) => {
        console.log('name = ', req.session.name);
        console.log('check session = ', req.session);
        
        //Đếm số lượng sản phẩm bán đc theo foods_id
        const top_foods = await pool.query(`SELECT food_id, sum(quantity)
        FROM order_items
        GROUP BY food_id`)
        
        const foods = await pool.query(`select * from foods`)
        const category_list = await pool.query(`select * from category`)

        if(typeof req.session.name == 'undefined'){
            res.render("index", {
                top_foods: top_foods.rows,
                foods: foods.rows,
                name: req.session.name,
                category_list: category_list.rows
            });
        }else{
            const search_order = await pool.query(`select * 
            from orders
            where owner_id = $1 and states = 'draft'`, [req.session.user_id])
            console.log('search_order = ', search_order.rows)


            if (search_order.rows == ''){
                res.render('index', {
                    quantity_foods: [{"count": 0}],
                    name: req.session.name,
                    foods: foods.rows,
                    top_foods: top_foods.rows,
                    category_list: category_list.rows
                })
            }else{
                const quantity_foods = await pool.query(`SELECT COUNT (food_id)
                FROM order_items
                where order_id = $1
                GROUP BY order_id = $2`, [search_order.rows[0]['id'], search_order.rows[0]['id']]) 
                res.render('index', {
                    quantity_foods: quantity_foods.rows,
                    name: req.session.name,
                    foods: foods.rows,
                    top_foods: top_foods.rows,
                    category_list: category_list.rows
                })
            }

        }
    })  
              
    app.get('/shop11', shop_routes)  
      
    app.get('/signup', (req, res) => {
        res.render('signup');
    })     

    app.post('/signup',urlencodedParser, async (req, res) => {
        let {name, phone, email, password, repassword} = req.body;

        let errors = []
        let success = []
        // regex email
        var regex = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
        
        if (regex.test(email) != true){
            errors.push({message: "Email invalid!"})
        }
        if (password.length < 6){
            errors.push({ message: "Password should be at least 6 characters"});
        }
        if (password != repassword){
            errors.push({ message: "Password do not match!"});
        }
        if (errors.length > 0){
            res.render('signup', {errors});
        }else{
            /*Khi lưu mật khẩu dưới db sẽ đc mã hóa dạng scram-sha-256, md5 hoặc dạng text kh mã hóa
        Tốt nhất nên mã hóa rồi lưu vào db */
            let hashed_password = await bcrypt.hash(password, 10);
            
            pool.query(
                'SELECT * FROM users WHERE email = $1',[email], (err, result) => {
                    if (err){
                        throw err;
                    }
                    //Kiểm tra email đã tồn tại trong hệ thống hay chưa
                    
                    if(result.rows.length > 0){
                        errors.push({message: "Email already registered!"})
                        console.log('errors = ', errors)
                        res.render('signup', {errors});
                    }else{
                        pool.query(
                            `INSERT INTO users(name, phone, email, password, roles)
                            VALUES ($1, $2, $3, $4, $5)
                            RETURNING id, password`,
                            [name, phone, email, hashed_password, 1], (err, result) => {
                                if(err){
                                    throw err;
                                }
                                console.log('result = ', result.rows)
                                req.flash('success_msg', "You're now registered, Please Log in")
                                res.redirect('/login');
                            }
                        );
                    }
                    
                }
            )

        }
        
    })  
    
    //route cập nhật thông tin tài khoản
    app.post('/update/:id', urlencodedParser, (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            let errors = []
            var regex = /^((09|03|07|08|05)+([0-9]{8})\b)$/

            if(regex.test(req.body.phone) != true){
                errors.push({message: "Phone invalid!"})
            }
            if (errors.length > 0){
                console.log('vào lỗi')
                pool.connect(function(err, client, done){
                    done()
                    if(err){
                        throw err;
                    }
    
                    pool.query(`select * from users where email = $1`, [req.session.email], (err, result)=>{
                        if(err){
                            throw err;
                        }
                        
                        res.render('information_user', {data: result.rows, errors: errors, name: req.session.name, user_id: req.session.user_id})
                    })
                });
            }else{
                pool.connect(function(err, client, done){
                    done()
                    if(err){
                        throw err;
                    }
        
                    pool.query(`update users set name = $1, phone = $2 where id = $3`, [req.body.name, req.body.phone, req.session.user_id], (err, result)=>{
                        if(err){
                            throw err;
                        }
    
                        console.log('info = ', result.rows)
                        console.log('update thành công')
                        res.redirect('/information_user')
                        // res.render('information_user', {data: result.rows, name: req.session.name, user_id: req.session.user_id})
                    })
                });
            }
            


        }
    })

    //route forgot pass
    //comming soon
    app.get('/forgot', (req, res) => {
                  
        // var kq = bcrypt.compareSync(password, pass_fromdb);
        res.render("forgot_password", {name: req.session.name});
    }) 

    //Trang about
    app.get('/about', urlencodedParser, async (req, res) => {
        if(typeof req.session.name != 'undefined'){
            
            const search_order = await pool.query(`select * 
            from orders
            where owner_id = $1 and states = 'draft'`, [req.session.user_id])
            if (search_order.rows == '') {
                    
                res.render('about', {
                    quantity_foods: [{"count": 0}],
                    name: req.session.name
                })
            }else{
                const quantity_foods = await pool.query(`SELECT COUNT (food_id)
                FROM order_items
                where order_id = $1
                GROUP BY order_id = $2`, [search_order.rows[0]['id'], search_order.rows[0]['id']])
    
                res.render("about", {
                    name: req.session.name,
                    quantity_foods: quantity_foods.rows
                });
            }
            
        }else{
            res.render("about", {name: req.session.name});
        }
    }) 

    //route blog
    app.get('/blog', urlencodedParser,async (req, res) => {
        const category = await pool.query(`select * from category`)
        if(typeof req.session.name != 'undefined'){
            
            const search_order = await pool.query(`select * 
            from orders
            where owner_id = $1 and states = 'draft'`, [req.session.user_id])
            if (search_order.rows == '') {
                    
                res.render('blog', {
                    quantity_foods: [{"count": 0}],
                    name: req.session.name,
                    category: category.rows
                })
            }else{
                const quantity_foods = await pool.query(`SELECT COUNT (food_id)
                FROM order_items
                where order_id = $1
                GROUP BY order_id = $2`, [search_order.rows[0]['id'], search_order.rows[0]['id']])

                res.render("blog", {
                    name: req.session.name,
                    quantity_foods: quantity_foods.rows,
                    category: category.rows
                });
            }
        }else{
            res.render("blog", {
                name: req.session.name,
                category: category.rows});
        }
    }) 

    //route thêm địa chỉ mới của kH
    app.get('/new_address', urlencodedParser, async(req, res) => {
        if(typeof req.session.name != 'undefined'){
            const search_order = await pool.query(`select * 
            from orders
            where owner_id = $1 and states = 'draft'`, [req.session.user_id])
            if (search_order.rows == '') {
                res.render("new_address", {
                    name: req.session.name,
                    quantity_foods: [{'count': 0}]
                });
            }else{
                const quantity_foods = await pool.query(`SELECT COUNT (food_id)
                FROM order_items
                where order_id = $1
                GROUP BY order_id = $2`, [search_order.rows[0]['id'], search_order.rows[0]['id']])

                res.render("new_address", {
                    name: req.session.name,
                    quantity_foods: quantity_foods.rows
                });
            }
        }else{
            res.redirect('/login')
        }
    }) 

    //route thêm địa chỉ mới của kH
    app.post('/new_address', urlencodedParser, async(req, res) => {
        if(typeof req.session.name != 'undefined'){
            let errors = []
            var regex = /^((09|03|07|08|05)+([0-9]{8})\b)$/
            //Kiểm tra số điện thoại hợp lệ hay không
            if(regex.test(req.body.phone) != true){
                errors.push({message: "Phone invalid!"})
                const search_order = await pool.query(`select * 
                from orders
                where owner_id = $1 and states = 'draft'`, [req.session.user_id])
                if (search_order.rows == '') {

                    res.render("dia_chi", {
                        name: req.session.name,
                        quantity_foods: [{'count': 0}],
                        errors: errors
                    });
                }else{
    
                    const quantity_foods = await pool.query(`SELECT COUNT (food_id)
                    FROM order_items
                    where order_id = $1
                    GROUP BY order_id = $2`, [search_order.rows[0]['id'], search_order.rows[0]['id']])
        
                    res.render("dia_chi", {
                        name: req.session.name,
                        quantity_foods: quantity_foods.rows,
                        errors: errors
                    });
                }
            }else{
                console.log('address_default = ', req.body.address_default);
                if(req.body.address_default == 'on'){

                    const all_address = await pool.query(`select * from addresses`);
                    for(var i=0; i<all_address.rows.length; i++){
                        console.log('address_default = ', all_address.rows[i]['address_default'])
                        if(all_address.rows[i]['address_default'] == true){
                            console.log('all_address = ', all_address.rows)
                            const update_address_default = await pool.query(`update addresses
                            set address_default = false
                            where id = $1`, [all_address.rows[i]['id']])
                        }
                    }
                    console.log('province = ', req.body.calc_shipping_provinces)
                    const add_address = await pool.query(`insert into addresses (user_id, address_default, phone, name, wardid, districtid, provinceid, street)
                    values ($1,$2,$3,$4,$5,$6,$7,$8);`, [req.session.user_id,true, req.body.phone, req.body.name, req.body.ward, req.body.calc_shipping_district, req.body.calc_shipping_provinces,req.body.street])

                    console.log('Thêm thành công')
                    res.redirect('/change_address')
                }else{
                    
                    const add_address = await pool.query(`insert into addresses (user_id, address_default, phone, name, wardid, districtid, provinceid, street)
                    values ($1,$2,$3,$4,$5,$6,$7,$8);`, [req.session.user_id,false, req.body.phone, req.body.name, req.body.ward, req.body.calc_shipping_district, req.body.calc_shipping_provinces,req.body.street])

                    console.log('Thêm thành công')
                    res.redirect('/change_address')
                }
            }
        }else{
            res.redirect('/login')
        }
    }) 

    //route đổi địa chỉ trong giỏ hàng
    app.get('/change_address', async (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            const search_order = await pool.query(`select * 
            from orders
            where owner_id = $1 and states = 'draft'`, [req.session.user_id])
            const list_address = await pool.query(`select * from addresses where user_id = $1`, [req.session.user_id])
            if (search_order.rows == ''){
                res.render("change_address", {
                    name: req.session.name,
                    order: search_order.rows,
                    list_address: list_address.rows
                });
                    
            }else{
                const quantity_foods = await pool.query(`SELECT COUNT (food_id)
                FROM order_items
                where order_id = $1
                GROUP BY order_id = $2`, [search_order.rows[0]['id'], search_order.rows[0]['id']])
        
                res.render("change_address", {
                    name: req.session.name,
                    order: search_order.rows,
                    quantity_foods: quantity_foods.rows,
                    list_address: list_address.rows
                });
            }
        }
    })

    //route giảm số lượng sản phẩm trong cart
    app.get('/minus/:order_item_id', urlencodedParser, async (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            const get_quantity = await pool.query(`select * from order_items where id=$1`,[req.params.order_item_id])
            if(get_quantity.rows[0]['quantity'] <= 1){
                res.redirect("/cart")
            }else{
                const update_quantity = await pool.query(`update order_items
                set quantity = $1
                where id=$2`,[get_quantity.rows[0]['quantity']-1, req.params.order_item_id]);
                res.redirect("/cart")
            }
        }
    })

    //route tăng số lượng sản phẩm trong cart
    app.get('/add/:order_item_id', urlencodedParser, async (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            const get_quantity = await pool.query(`select * from order_items where id=$1`,[req.params.order_item_id])
            const update_quantity = await pool.query(`update order_items
            set quantity = $1
            where id=$2`,[get_quantity.rows[0]['quantity']+1, req.params.order_item_id]);
            res.redirect("/cart")
        }
    })

    //route xác nhận địa chỉ giao hàng
    app.get('/approve_address/:address_id&:order_id', urlencodedParser, async (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            console.log('address_id = ', req.params.address_id, ' order_id = ', req.params.order_id)
            const update_address = await pool.query(`update orders
            set address_id = $1
            where id=$2`,[req.params.address_id, req.params.order_id]);
            res.redirect("/cart")
        }
    })

    // xóa địa chỉ giao hàng
    app.get('/delete_address/:id', urlencodedParser, async (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            const del_wishlist = await pool.query(`DELETE FROM addresses WHERE id = $1`,[req.params.id]);
            res.redirect("/change_address")
        }
    })

    //route lấy thông tin đơn đặt hàng
    app.get('/orders', async (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            const orders = await pool.query(`select * from orders where owner_id = $1`, [req.session.user_id])
            const search_order = await pool.query(`select * 
            from orders
            where owner_id = $1 and states = 'draft'`, [req.session.user_id])
            if (search_order.rows == '') {
                    
                res.render('order_users', {
                    quantity_foods: [{"count": 0}],
                    orders: orders.rows,
                    name: req.session.name
                })
            }else{
                const quantity_foods = await pool.query(`SELECT COUNT (food_id)
                FROM order_items
                where order_id = $1
                GROUP BY order_id = $2`, [search_order.rows[0]['id'], search_order.rows[0]['id']])

                res.render("order_users", {
                    name: req.session.name,
                    orders: orders.rows,
                    quantity_foods: quantity_foods.rows
                });
            }

        }
    })

    
    //route lấy thông tin chi tiết đơn đặt hàng
    app.get('/order_details/:id', async (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{

            const order = await pool.query(`select orders.id, orders.address_id, orders.owner_id, orders.delivery_time, orders.delivery_fee, orders.discount, orders.amount, orders.states, addresses.street, addresses.wardid, addresses.districtid, addresses.provinceid
            from orders, addresses
            where orders.address_id = addresses.id and orders.id = $1`, [req.params.id])
            const order_items = await pool.query(`select *
            from order_items
            where order_id = $1`, [req.params.id])
            const owner_order = await pool.query(`select * from users where id = $1`, [order.rows[0]['owner_id']])
            const address = await pool.query(`select * from addresses where id = $1`, [order.rows[0]['address_id']])

            const orders = await pool.query(`select * from orders where owner_id = $1`, [req.session.user_id])
            const foods = await pool.query(`select * from foods`)
            const search_order = await pool.query(`select * 
            from orders
            where owner_id = $1 and states = 'draft'`, [req.session.user_id])
            if (search_order.rows == '') {
                    
                res.render('order_users_detail', {
                    quantity_foods: [{"count": 0}],
                    orders: orders.rows,
                    name: req.session.name,
                    order: order.rows,
                    order_items: order_items.rows,
                    owner_order: owner_order.rows,
                    address: address.rows,
                    foods: foods.rows
                })
            }else{
                const quantity_foods = await pool.query(`SELECT COUNT (food_id)
                FROM order_items
                where order_id = $1
                GROUP BY order_id = $2`, [search_order.rows[0]['id'], search_order.rows[0]['id']])

                res.render("order_users_detail", {
                    name: req.session.name,
                    orders: orders.rows,
                    quantity_foods: quantity_foods.rows,
                    order: order.rows,
                    order_items: order_items.rows,
                    owner_order: owner_order.rows,
                    address: address.rows,
                    foods: foods.rows
                });
            }

        }
    })

    
    //route lấy thông tin giỏ hàng
    app.get('/cart', async (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            let errors = []
            const search_order = await pool.query(`select * 
            from orders
            where owner_id = $1 and states = 'draft'`, [req.session.user_id])
            const cart_user = await pool.query(`select order_items.id, order_items.food_id, order_items.quantity, foods.name, foods.description, foods.price, foods.images
            from orders, order_items, foods
            where orders.id = order_items.order_id and order_items.food_id = foods.id and orders.owner_id = $1 and orders.states='draft'`,[req.session.user_id]);
            
            if(search_order.rows.length > 0){
                if(cart_user.rows.length > 0){ 
                    const quantity_foods = await pool.query(`SELECT COUNT (food_id)
                    FROM order_items
                    where order_id = $1
                    GROUP BY order_id = $2`, [search_order.rows[0]['id'], search_order.rows[0]['id']])
                    const order_items = await pool.query(`select * from order_items where order_id = $1`, [search_order.rows[0]['id']])
                    const get_address_default = await pool.query(`select * from addresses where user_id = $1 and address_default = true`, [req.session.user_id])
                    // const total = await pool.query(`SELECT sum (price)
                    // FROM order_items
                    // GROUP BY order_id = $1`, [search_order.rows[0]['id']])         
                    let total = 0
                    for(var i=0; i<order_items.rows.length; i++){
                        total += (order_items.rows[i]['quantity'] * order_items.rows[i]['price'])
                    }
    
                    let discount = 1
                    if(total >= 350000){
                        discount = 0
                    }
                    if(search_order.rows[0]['address_id'] != null){
                        console.log('hello')
                        const address = await pool.query(`select * from addresses where id = $1`, [search_order.rows[0]['address_id']])
                        if(discount>0){
                            const totals = Number(total) + Number(search_order.rows[0]['delivery_fee'])
                            
                            res.render("cart", {
                                cart_user: cart_user.rows,
                                order_id: search_order.rows[0]['id'],
                                order: address.rows,
                                name: req.session.name,
                                quantity_foods: quantity_foods.rows,
                                subtotal: total,
                                fee_ship: search_order.rows[0]['delivery_fee'],
                                total: totals,
                                discount: discount,
                                errors: errors
                            });
                        }else{
                            const totals = (Number(total) + Number(search_order.rows[0]['delivery_fee'])) - Number(search_order.rows[0]['delivery_fee'])
                            console.log('total = ', total);
                            res.render("cart", {
                                cart_user: cart_user.rows,
                                order_id: search_order.rows[0]['id'],
                                order: address.rows,
                                name: req.session.name,
                                quantity_foods: quantity_foods.rows,
                                subtotal: total,
                                fee_ship: search_order.rows[0]['delivery_fee'],
                                total: totals,
                                discount: discount,
                                errors: errors
                            });
                        }
                    }else{
                        if(get_address_default.rows.length > 0){
                            const add_adress_default = await pool.query(`update orders
                            set address_id = $1
                            where id=$2`, [get_address_default.rows[0]['id'], search_order.rows[0]['id']])
                            const search_order_new = await pool.query(`select * 
                            from orders
                            where owner_id = $1 and states = 'draft'`, [req.session.user_id])
                            const address = await pool.query(`select * from addresses where id = $1`, [search_order_new.rows[0]['address_default']])
                            if(discount>0){
                                const totals = Number(total) + Number(search_order.rows[0]['delivery_fee'])
                                
                                res.render("cart", {
                                    cart_user: cart_user.rows,
                                    order_id: search_order.rows[0]['id'],
                                    order: address.rows,
                                    name: req.session.name,
                                    quantity_foods: quantity_foods.rows,
                                    subtotal: total,
                                    fee_ship: search_order_new.rows[0]['delivery_fee'],
                                    total: totals,
                                    discount: discount,
                                    errors: errors
                                });
                            }else{
                                const totals = (Number(total) + Number(search_order.rows[0]['delivery_fee'])) - Number(search_order.rows[0]['delivery_fee'])
                                console.log('total = ', total);
                                res.render("cart", {
                                    cart_user: cart_user.rows,
                                    order_id: search_order.rows[0]['id'],
                                    order: address.rows,
                                    name: req.session.name,
                                    quantity_foods: quantity_foods.rows,
                                    subtotal: total,
                                    fee_ship: search_order.rows[0]['delivery_fee'],
                                    total: totals,
                                    discount: discount,
                                    errors: errors
                                });
                            }
                        }else{
                            if(discount>0){
                                const totals = Number(total) + Number(search_order.rows[0]['delivery_fee'])
                                
                                res.render("cart", {
                                    cart_user: cart_user.rows,
                                    order_id: search_order.rows[0]['id'],
                                    order: '',
                                    name: req.session.name,
                                    quantity_foods: quantity_foods.rows,
                                    subtotal: total,
                                    fee_ship: search_order.rows[0]['delivery_fee'],
                                    total: totals,
                                    discount: discount,
                                    errors: errors
                                });
                            }else{
                                const totals = (Number(total) + Number(search_order.rows[0]['delivery_fee'])) - Number(search_order.rows[0]['delivery_fee'])
                                console.log('total = ', total);
                                res.render("cart", {
                                    cart_user: cart_user.rows,
                                    order_id: search_order.rows[0]['id'],
                                    order: '',
                                    name: req.session.name,
                                    quantity_foods: quantity_foods.rows,
                                    subtotal: total,
                                    fee_ship: search_order.rows[0]['delivery_fee'],
                                    total: totals,
                                    discount: discount,
                                    errors: errors
                                });
                            }
                        }
                    }
                }else{
                    res.render("cart", {
                        cart_user: cart_user.rows, 
                        name: req.session.name,
                        quantity_foods: [{"count": 0}],
                        errors: errors
                    });
                }
            }else{
                res.render("cart", {
                    cart_user: cart_user.rows, 
                    name: req.session.name,
                    quantity_foods: [{"count": 0}],
                    errors: errors
                });
            }
        }
    })  

    //route xóa sản phẩm khỏi giỏ hàng
    app.get('/del_pro_cart/:id', async (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            const del_pro_cart = await pool.query(`DELETE FROM order_items WHERE id = $1`,[req.params.id])
            console.log('xóa sản phẩm trong giỏ thành công')
            res.redirect('/cart')
        }
    })
        
    //route thêm sản phẩm khỏi giỏ hàng
    app.get('/add_to_cart/:id', urlencodedParser, async (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            const order_items = await pool.query(`select order_items.id, order_items.food_id, order_items.quantity
            from orders, order_items
            where orders.id = order_items.order_id and order_items.food_id = $1 and orders.owner_id = $2 and orders.states='draft'`, [req.params.id,req.session.user_id])
            const fee_delivery = await pool.query(`select * from type_of_delivery where id = 1`)
            var flag_order_items = 0
            var quantity_new = 0
            for(var i=0; i<order_items.rows.length; i++){
                if(req.params.id == order_items.rows[i]['food_id']){
                    console.log('có trong order_item')
                    flag_order_items = 1
                }
            }
            // kiểm tra sản phẩm có tồn tại trong giỏ hàng chưa
            if(flag_order_items > 0){
                quantity_new = order_items.rows[0]['quantity'] + 1
                const update_quantity = await pool.query(`update order_items
                set quantity = $1
                where food_id = $2;`,[quantity_new, req.params.id]);
                console.log('Cập nhật thành công')
                res.redirect('/shop/0');
            }else{
                const fee = fee_delivery.rows
                // kiểm tra giỏ hàng có trạng thái là draft
                const orders = await pool.query(`select * from orders where owner_id = $1 and states = 'draft'`,[req.session.user_id])
                const orders_vals = orders.rows
                console.log('orders_vals = ', orders_vals)
                if(orders_vals != ''){

                    const search_order_new = await pool.query(`select * 
                    from orders
                    where owner_id = $1 and states = 'draft'`, [req.session.user_id])
                    const order_new = search_order_new.rows
                    console.log('order_new = ', order_new)
                    const search_food = await pool.query(`select * from foods where id = $1`, [req.params.id])
                    const price_food = search_food.rows
                    console.log('search_order_new = ', order_new)
                    const add_to_cart = await pool.query(`insert into order_items (order_id, food_id, quantity, price)
                    values ($1,$2,1,$3);`, [order_new[0]['id'], req.params.id, price_food[0]['price']])
                    
                    res.redirect('/shop/0')
                }else{
                    const create_order = await pool.query(`insert into orders (owner_id, delivery_type_id, delivery_fee, states)
                    values ($1,2,$2,'draft');`, [req.session.user_id, fee[0]['fee']])
                    const search_order_new = await pool.query(`select * 
                    from orders
                    where owner_id = $1 and states = 'draft'`, [req.session.user_id])
                    const order_new = search_order_new.rows
                    const search_food = await pool.query(`select * from foods where id = $1`, [req.params.id])
                    const price_food = search_food.rows
                    console.log('search_order_new = ', order_new)
                    const add_to_cart = await pool.query(`insert into order_items (order_id, food_id, quantity, price)
                    values ($1,$2,1,$3);`, [order_new[0]['id'], req.params.id, price_food[0]['price']])

                    res.redirect('/shop/0')
                }
                
                
            }
        }
    })

    //route xem chi tiết blog
    app.get('/blog-single', (req, res) => {
        res.render("blog-single", {name: req.session.name});
    })             
            
    //route xác nhận thanh toán
    app.post('/checkout', urlencodedParser, async(req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            console.log('body = ', req.body)

            let errors = []
            var today = new Date();
            var date, day, month, year;
            //tính thời gian giao hàng
            if((today.getMonth()+1) == 1 || (today.getMonth()+1) == 3 || (today.getMonth()+1) == 5 || (today.getMonth()+1) == 7 || (today.getMonth()+1) == 8 || (today.getMonth()+1) == 10 || (today.getMonth()+1) == 12){
                var tmp_day = 3 - (31 - today.getDate())
                if(tmp_day == 0){
                    day = 3
                    if((today.getMonth()+1) == 12){
                        month = 1
                        year = today.getFullYear()+1
                    }else{
                        month = (today.getMonth()+1) + 1
                        year = today.getFullYear()
                    }
                }else if(tmp_day > 0){
                    day = tmp_day
                    if((today.getMonth()+1) == 12){
                        month = 1
                        year = today.getFullYear()+1
                    }else{
                        month = (today.getMonth()+1) + 1
                        year = today.getFullYear()
                    }
                }else{
                    day = today.getDate()
                    month = (today.getMonth()+1)
                    year = today.getFullYear()
                }
            }else if((today.getMonth()+1) == 2){
                var leapYear = function(year){
                    if ((year % 4===0 &&year%100 !==0 && year % 400 !==0)||(year%100===0 && year % 400===0)){
                        return true
                    } else{
                        return false
                    }
                };
                if(leapYear(today.getFullYear()) == true){
                    var tmp_day = 3 - (29 - today.getDate())
                    if(tmp_day == 0){
                        day = 3
                        if((today.getMonth()+1) == 12){
                            month = 1
                            year = today.getFullYear()+1
                        }else{
                            month = (today.getMonth()+1) + 1
                            year = today.getFullYear()
                        }
                    }else if(tmp_day > 0){
                        day = tmp_day
                        if((today.getMonth()+1) == 12){
                            month = 1
                            year = today.getFullYear()+1
                        }else{
                            month = (today.getMonth()+1) + 1
                            year = today.getFullYear()
                        }
                    }else{
                        day = today.getDate()
                        month = (today.getMonth()+1)
                        year = today.getFullYear()
                    }
                }else{
                    var tmp_day = 3 - (28 - today.getDate())
                    if(tmp_day == 0){
                        day = 3
                        if((today.getMonth()+1) == 12){
                            month = 1
                            year = today.getFullYear()+1
                        }else{
                            month = (today.getMonth()+1) + 1
                            year = today.getFullYear()
                        }
                    }else if(tmp_day > 0){
                        day = tmp_day
                        if((today.getMonth()+1) == 12){
                            month = 1
                            year = today.getFullYear()+1
                        }else{
                            month = (today.getMonth()+1) + 1
                            year = today.getFullYear()
                        }
                    }else{
                        day = today.getDate()
                        month = (today.getMonth()+1)
                        year = today.getFullYear()
                    }
                }
                
            }else{
                var tmp_day = 3 - (30 - today.getDate())
                if(tmp_day == 0){
                    day = 3
                    if((today.getMonth()+1) == 12){
                        month = 1
                        year = today.getFullYear()+1
                    }else{
                        month = (today.getMonth()+1) + 1
                        year = today.getFullYear()
                    }
                }else if(tmp_day > 0){
                    day = tmp_day
                    if((today.getMonth()+1) == 12){
                        month = 1
                        year = today.getFullYear()+1
                    }else{
                        month = (today.getMonth()+1) + 1
                        year = today.getFullYear()
                    }
                }else{
                    day = today.getDate() + 3
                    month = (today.getMonth()+1)
                    year = today.getFullYear()
                }
            }
            
            const check_address = await pool.query(`select * from orders where id = $1`, [req.body.order_id])
            
            const dates = new Date(Date.UTC(year, month-1, day,today.getHours(),today.getMinutes(), today.getSeconds()));
            if(check_address.rows[0]['address_id'] != null){
                console.log('hello')
                if(typeof req.body.discount != 'undefined'){
                    const confirm_order = await pool.query(`update orders
                    set delivery_time = $1, amount = $2, discount = $3, states = 'done'
                    where id = $4;`, [new Intl.DateTimeFormat().format(dates), req.body.amount, req.body.discount, req.body.order_id])
                    
                    console.log('mua hàng thành công')
                    res.redirect('/')
                }else{
    
                    const confirm_order = await pool.query(`update orders
                    set delivery_time = $1, amount = $2, discount = $3, states = 'done'
                    where id = $4;`, [new Intl.DateTimeFormat().format(dates), req.body.amount, 0, req.body.order_id])
                    
                    console.log('mua hàng thành công')
                    res.redirect('/')
                }
            }else{
                console.log('hello mấy cưng')
                errors.push({errors: "Please choose address"})

                const search_order = await pool.query(`select * 
                from orders
                where owner_id = $1 and states = 'draft'`, [req.session.user_id])
                const cart_user = await pool.query(`select order_items.id, order_items.food_id, order_items.quantity, foods.name, foods.description, foods.price, foods.images
                from orders, order_items, foods
                where orders.id = order_items.order_id and order_items.food_id = foods.id and orders.owner_id = $1 and orders.states='draft'`,[req.session.user_id]);
                
                if(search_order.rows.length > 0){
                    if(cart_user.rows.length > 0){ 
                        const quantity_foods = await pool.query(`SELECT COUNT (food_id)
                        FROM order_items
                        where order_id = $1
                        GROUP BY order_id = $2`, [search_order.rows[0]['id'], search_order.rows[0]['id']])
                        const order_items = await pool.query(`select * from order_items where order_id = $1`, [search_order.rows[0]['id']])
                        const get_address_default = await pool.query(`select * from addresses where user_id = $1 and address_default = true`, [req.session.user_id])
                        // const total = await pool.query(`SELECT sum (price)
                        // FROM order_items
                        // GROUP BY order_id = $1`, [search_order.rows[0]['id']])         
                        let total = 0
                        for(var i=0; i<order_items.rows.length; i++){
                            total += (order_items.rows[i]['quantity'] * order_items.rows[i]['price'])
                        }
        
                        let discount = 1
                        if(total >= 350000){
                            discount = 0
                        }
                        if(search_order.rows[0]['address_id'] != null){
                            console.log('hello')
                            const address = await pool.query(`select * from addresses where id = $1`, [search_order.rows[0]['address_id']])
                            if(discount>0){
                                const totals = Number(total) + Number(search_order.rows[0]['delivery_fee'])
                                
                                res.render("cart", {
                                    cart_user: cart_user.rows,
                                    order_id: search_order.rows[0]['id'],
                                    order: address.rows,
                                    name: req.session.name,
                                    quantity_foods: quantity_foods.rows,
                                    subtotal: total,
                                    fee_ship: search_order.rows[0]['delivery_fee'],
                                    total: totals,
                                    discount: discount,
                                    errors: errors
                                });
                            }else{
                                const totals = (Number(total) + Number(search_order.rows[0]['delivery_fee'])) - Number(search_order.rows[0]['delivery_fee'])
                                console.log('total = ', total);
                                res.render("cart", {
                                    cart_user: cart_user.rows,
                                    order_id: search_order.rows[0]['id'],
                                    order: address.rows,
                                    name: req.session.name,
                                    quantity_foods: quantity_foods.rows,
                                    subtotal: total,
                                    fee_ship: search_order.rows[0]['delivery_fee'],
                                    total: totals,
                                    discount: discount,
                                    errors: errors
                                });
                            }
                        }else{
                            if(get_address_default.rows.length > 0){
                                const add_adress_default = await pool.query(`update orders
                                set address_id = $1
                                where id=$2`, [get_address_default.rows[0]['id'], search_order.rows[0]['id']])
                                const search_order_new = await pool.query(`select * 
                                from orders
                                where owner_id = $1 and states = 'draft'`, [req.session.user_id])
                                const address = await pool.query(`select * from addresses where id = $1`, [search_order_new.rows[0]['address_default']])
                                if(discount>0){
                                    const totals = Number(total) + Number(search_order.rows[0]['delivery_fee'])
                                    
                                    res.render("cart", {
                                        cart_user: cart_user.rows,
                                        order_id: search_order.rows[0]['id'],
                                        order: address.rows,
                                        name: req.session.name,
                                        quantity_foods: quantity_foods.rows,
                                        subtotal: total,
                                        fee_ship: search_order_new.rows[0]['delivery_fee'],
                                        total: totals,
                                        discount: discount,
                                        errors: errors
                                    });
                                }else{
                                    const totals = (Number(total) + Number(search_order.rows[0]['delivery_fee'])) - Number(search_order.rows[0]['delivery_fee'])
                                    console.log('total = ', total);
                                    res.render("cart", {
                                        cart_user: cart_user.rows,
                                        order_id: search_order.rows[0]['id'],
                                        order: address.rows,
                                        name: req.session.name,
                                        quantity_foods: quantity_foods.rows,
                                        subtotal: total,
                                        fee_ship: search_order.rows[0]['delivery_fee'],
                                        total: totals,
                                        discount: discount,
                                        errors: errors
                                    });
                                }
                            }else{
                                if(discount>0){
                                    const totals = Number(total) + Number(search_order.rows[0]['delivery_fee'])
                                    
                                    res.render("cart", {
                                        cart_user: cart_user.rows,
                                        order_id: search_order.rows[0]['id'],
                                        order: '',
                                        name: req.session.name,
                                        quantity_foods: quantity_foods.rows,
                                        subtotal: total,
                                        fee_ship: search_order.rows[0]['delivery_fee'],
                                        total: totals,
                                        discount: discount,
                                        errors: errors
                                    });
                                }else{
                                    const totals = (Number(total) + Number(search_order.rows[0]['delivery_fee'])) - Number(search_order.rows[0]['delivery_fee'])
                                    console.log('total = ', total);
                                    res.render("cart", {
                                        cart_user: cart_user.rows,
                                        order_id: search_order.rows[0]['id'],
                                        order: '',
                                        name: req.session.name,
                                        quantity_foods: quantity_foods.rows,
                                        subtotal: total,
                                        fee_ship: search_order.rows[0]['delivery_fee'],
                                        total: totals,
                                        discount: discount,
                                        errors: errors
                                    });
                                }
                            }
                        }
                    }else{
                        res.render("cart", {
                            cart_user: cart_user.rows, 
                            name: req.session.name,
                            quantity_foods: [{"count": 0}],
                            errors: errors
                        });
                    }
                }else{
                    res.render("cart", {
                        cart_user: cart_user.rows, 
                        name: req.session.name,
                        quantity_foods: [{"count": 0}],
                        errors: errors
                    });
                }
            }
        }
    }) 

    //route contact
    app.get('/contact', urlencodedParser,async (req, res) => {
        if(typeof req.session.name != 'undefined'){
            
            const search_order = await pool.query(`select * 
            from orders
            where owner_id = $1 and states = 'draft'`, [req.session.user_id])
            if (search_order.rows == '') {
                    
                res.render('contact', {
                    quantity_foods: [{"count": 0}],
                    name: req.session.name
                })
            }else{
                const quantity_foods = await pool.query(`SELECT COUNT (food_id)
                FROM order_items
                where order_id = $1
                GROUP BY order_id = $2`, [search_order.rows[0]['id'], search_order.rows[0]['id']])

                res.render("contact", {
                    name: req.session.name,
                    quantity_foods: quantity_foods.rows
                });
            }
        }else{
            res.render("contact", {name: req.session.name});
        }
    })      
    //route xem sản phẩm chi tiết    
    app.get('/product-single/:id', async (req, res) => {
        const product_signle = await pool.query(`select * from foods where id = $1`, [req.params.id])
        const wishlist = await pool.query(`select count(*)
        from wishlist
        where user_id = $1;`, [req.params.id])
        
        const search_order = await pool.query(`select * 
        from orders
        where owner_id = $1 and states = 'draft'`, [req.session.user_id])
        if (search_order.rows == '') {
                
            res.render('product-single', {
                data: product_signle.rows,
                quantity_foods: [{"count": 0}],
                name: req.session.name
            })
        }else{
            const quantity_foods = await pool.query(`SELECT COUNT (food_id)
            FROM order_items
            where order_id = $1
            GROUP BY order_id = $2`, [search_order.rows[0]['id'], search_order.rows[0]['id']])

            res.render('product-single', {
                data: product_signle.rows,
                name: req.session.name,
                quantity_foods: quantity_foods.rows,
                wishlist: wishlist.rows,
            })
        }
    })          

    //route trang shop
    app.get('/shop/:id', async(req, res) =>{
        if(typeof req.session.user == 'undefined'){
            const category_id = req.params.id;
            if(category_id == 0){
                const foods = await pool.query(`SELECT * FROM foods`);
                const category = await pool.query(`SELECT * FROM category`);
                res.render('shop11', {foods: foods.rows, 
                    category: category.rows, 
                    name:req.session.name,
                    category_id: category_id
                })
            }else{
                const foods = await pool.query(`SELECT * FROM foods where category_id = $1`,[category_id]);
                const category = await pool.query(`SELECT * FROM category`);
                res.render('shop11', {foods: foods.rows, 
                    category: category.rows, 
                    name:req.session.name,
                    category_id: category_id
                })
            }
        }else{
            
            const category_id = req.params.id;
            const wishlist = await pool.query(`select * from wishlist where user_id = $1`, [req.session.user_id])
            
            const search_order = await pool.query(`select * 
            from orders
            where owner_id = $1 and states = 'draft'`, [req.session.user_id])
            if (search_order.rows == '') {
                
                if(category_id == 0){
                    const foods = await pool.query(`SELECT * FROM foods`);
                    const category = await pool.query(`SELECT * FROM category`);
                    
                    res.render('shop11', {
                        foods: foods.rows, 
                        category: category.rows, 
                        name:req.session.name,
                        category_id: category_id,
                        quantity_foods: [{"count": 0}],
                        wishlist: wishlist.rows
                    })
                }else{
                    const foods = await pool.query(`SELECT * FROM foods where category_id = $1`,[category_id]);
                    const category = await pool.query(`SELECT * FROM category`);
                    res.render('shop11', {foods: foods.rows, 
                        category: category.rows, 
                        name:req.session.name,
                        category_id: category_id,
                        quantity_foods: [{"count": 0}],
                        wishlist: wishlist.rows
                    })
                }
            }else{
                const quantity_foods = await pool.query(`SELECT COUNT (food_id)
                FROM order_items
                where order_id = $1
                GROUP BY order_id = $2`, [search_order.rows[0]['id'], search_order.rows[0]['id']])

                if(category_id == 0){
                    const foods = await pool.query(`SELECT * FROM foods`);
                    const category = await pool.query(`SELECT * FROM category`);
                    
                    res.render('shop11', {
                        foods: foods.rows, 
                        category: category.rows, 
                        name:req.session.name,
                        category_id: category_id,
                        quantity_foods: quantity_foods.rows,
                        wishlist: wishlist.rows
                    })
                }else{
                    const foods = await pool.query(`SELECT * FROM foods where category_id = $1`,[category_id]);
                    const category = await pool.query(`SELECT * FROM category`);
                    res.render('shop11', {foods: foods.rows, 
                        category: category.rows, 
                        name:req.session.name,
                        category_id: category_id,
                        quantity_foods: quantity_foods.rows,
                        wishlist: wishlist.rows
                    })
                }
            }
        }
    })   
    //route thêm sản phẩm vào danh sách yêu thích       
    app.get('/add_wishlist/:id', urlencodedParser, async (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            const wishlist_user = await pool.query(`insert into wishlist (product_id, user_id)
            values ($1, $2);`,[req.params.id, req.session.user_id]);
            res.redirect("/wishlist");
            
        }
    })   

    //route lấy danh sách yêu thích  
    app.get('/wishlist', async (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            
            const wishlist_user = await pool.query(`select wishlist.id,wishlist.user_id, wishlist.product_id, foods.name, foods.description, foods.category_id, foods.images, foods.price
            from wishlist, foods
            where wishlist.product_id = foods.id and wishlist.user_id = $1`,[req.session.user_id]);

            
            const search_order = await pool.query(`select * 
            from orders
            where owner_id = $1 and states = 'draft'`, [req.session.user_id])
            if (search_order.rows == '') {

                console.log('wishlist = ', wishlist_user.rows)
                res.render("wishlist", {
                    wishlist: wishlist_user.rows,
                    name: req.session.name,
                    quantity_foods: [{"count": 0}]
                });
            }else{
                const quantity_foods = await pool.query(`SELECT COUNT (food_id)
                FROM order_items
                where order_id = $1
                GROUP BY order_id = $2`, [search_order.rows[0]['id'], search_order.rows[0]['id']])
    
    
                console.log('wishlist = ', wishlist_user.rows)
                res.render("wishlist", {
                    wishlist: wishlist_user.rows,
                    name: req.session.name,
                    quantity_foods: quantity_foods.rows
                });
            }
            
        }
    }) 

    
    //route xóa sản phẩm khỏi danh sách yêu thích  
    app.get('/del_wishlist/:id', urlencodedParser, async (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            const del_wishlist = await pool.query(`DELETE FROM wishlist WHERE id = $1`,[req.params.id]);
            res.redirect("/wishlist")
        }
    })

    //route xóa sản phẩm trong admin
    app.get('/del_pro/:id', urlencodedParser, (req, res) => {
        pool.connect(function(err,client, done){
            if(err){
                throw err;
            }
            pool.query(`DELETE FROM foods WHERE id = $1`, [req.params.id], (err, result)=>{
                if(err){
                    throw err;
                }
                console.log('xóa thành công');
                res.redirect('/product_dashboard');
            })
        })
    }) 

    //route lấy form sửa sản phẩm trong admin
    app.get('/edit_pro/:id', urlencodedParser,async (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            const food = await pool.query(`select * FROM foods WHERE id = $1`, [req.params.id])
            const category = await pool.query(`select * FROM category`)

            res.render('product_edit', {
                data: food.rows, 
                name: req.session.name, 
                email: req.session.email,
                category: category.rows
            });
        }
    })

    //route chỉnh sửa sản phẩm trong admin
    app.post('/edit_pro/:id', urlencodedParser,  upload.single('image'), async (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{

            const imagePath = path.join(__dirname, '../public/images/');
            const fileUpload = new Resize(imagePath);
            if (!req.file) {
                // res.status(401).json({error: 'Please provide an image'});
                const update_product = await pool.query(`update foods
                set name=$1, description=$2,category_id=$3, price = $4
                where id=$5;`, [req.body.name, req.body.description, req.body.category, req.body.price, req.params.id])

                console.log('Cập nhật thành công')
                res.redirect('/product_dashboard');
            }else{
                const filename = await fileUpload.save(req.file.buffer);
                const update_product = pool.query(`update foods
                set name=$1, description=$2,category_id=$3, price = $4, images=$5
                where id=$6;`, [req.body.name, req.body.description, req.body.category, req.body.price, 'images/'+filename, req.params.id])
                console.log('Cập nhật thành công')
                res.redirect('/product_dashboard');
                
            }
        }
    })

    //route thêm địa chỉ của KH
    app.get('/dia_chi', urlencodedParser, async(req, res) => {
        if(typeof req.session.name != 'undefined'){
            const search_order = await pool.query(`select * 
            from orders
            where owner_id = $1 and states = 'draft'`, [req.session.user_id])
            if (search_order.rows == '') {
                res.render("dia_chi", {
                    name: req.session.name,
                    quantity_foods: [{'count': 0}]
                });
            }else{

                const quantity_foods = await pool.query(`SELECT COUNT (food_id)
                FROM order_items
                where order_id = $1
                GROUP BY order_id = $2`, [search_order.rows[0]['id'], search_order.rows[0]['id']])

                res.render("dia_chi", {
                    name: req.session.name,
                    quantity_foods: quantity_foods.rows
                });
            }
        }else{
            res.redirect('/login')
        }
    }) 

    //route kiểm tra địa chỉ của KH
    app.post('/dia_chi', urlencodedParser, async(req, res) => {
        if(typeof req.session.name != 'undefined'){
            let errors = []
            var regex = /^((09|03|07|08|05)+([0-9]{8})\b)$/
            //kiểm tra số điện thoại hợp lệ
            if(regex.test(req.body.phone) != true){
                errors.push({message: "Phone invalid!"})
                const search_order = await pool.query(`select * 
                from orders
                where owner_id = $1 and states = 'draft'`, [req.session.user_id])
                if (search_order.rows == '') {

                    res.render("dia_chi", {
                        name: req.session.name,
                        quantity_foods: [{'count': 0}],
                        errors: errors
                    });
                }else{
    
                    const quantity_foods = await pool.query(`SELECT COUNT (food_id)
                    FROM order_items
                    where order_id = $1
                    GROUP BY order_id = $2`, [search_order.rows[0]['id'], search_order.rows[0]['id']])
    
                    res.render("dia_chi", {
                        name: req.session.name,
                        quantity_foods: quantity_foods.rows,
                        errors: errors
                    });
                }
            }else{
                console.log('address_default = ', req.body.address_default);
                if(req.body.address_default == 'on'){

                    const all_address = await pool.query(`select * from addresses where user_id = $1`, [req.session.user_id]);
                    for(var i=0; i<all_address.rows.length; i++){
                        console.log('address_default = ', all_address.rows[i]['address_default'])
                        if(all_address.rows[i]['address_default'] == true){
                            console.log('all_address = ', all_address.rows)
                            const update_address_default = await pool.query(`update addresses
                            set address_default = false
                            where id = $1`, [all_address.rows[i]['id']])
                        }
                    }
                    console.log('province = ', req.body.calc_shipping_provinces)
                    const add_address = await pool.query(`insert into addresses (user_id, address_default, phone, name, wardid, districtid, provinceid, street)
                    values ($1,$2,$3,$4,$5,$6,$7,$8);`, [req.session.user_id,true, req.body.phone, req.body.name, req.body.ward, req.body.calc_shipping_district, req.body.calc_shipping_provinces,req.body.street])

                    console.log('Thêm thành công')
                    res.redirect('/show_dia_chi')
                }else{
                    
                    const add_address = await pool.query(`insert into addresses (user_id, address_default, phone, name, wardid, districtid, provinceid, street)
                    values ($1,$2,$3,$4,$5,$6,$7,$8);`, [req.session.user_id,false, req.body.phone, req.body.name, req.body.ward, req.body.calc_shipping_district, req.body.calc_shipping_provinces,req.body.street])

                    console.log('Thêm thành công')
                    res.redirect('/show_dia_chi')
                }
            }
        }else{
            res.redirect('/login')
        }
    }) 
    
    //route lấy form chỉnh sửa địa chỉ của kh
    app.get('/edit_addresses/:id', urlencodedParser,async (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            const address = await pool.query(`select * FROM addresses WHERE id = $1`, [req.params.id])
            const search_order = await pool.query(`select * 
            from orders
            where owner_id = $1 and states = 'draft'`, [req.session.user_id])
            if(search_order.rows != ''){
                const quantity_foods = await pool.query(`SELECT COUNT (food_id)
                FROM order_items
                where order_id = $1
                GROUP BY order_id = $2`, [search_order.rows[0]['id'], search_order.rows[0]['id']])
    
                res.render('edit_dia_chi', {
                    name: req.session.name, 
                    user_id: req.session.user_id,
                    quantity_foods: quantity_foods.rows,
                    address: address.rows
                })
            }else{
                res.render('edit_dia_chi', {
                    name: req.session.name,
                    address: address.rows,
                    quantity_foods: [{"count": 0}]
                });
            }
        }
    })

    //route cập nhật chỉnh sửa địa chỉ của kh
    app.post('/edit_addresses/:id', urlencodedParser,  upload.single('image'), async (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            const address = await pool.query(`select * FROM addresses WHERE id = $1`, [req.params.id])
            const search_order = await pool.query(`select * 
            from orders
            where owner_id = $1 and states = 'draft'`, [req.session.user_id])

            var regex = /^((09|03|07|08|05)+([0-9]{8})\b)$/
            let errors = []
            if(regex.test(req.body.phone) != true){
                errors.push({message: "Phone invalid!"})
                const search_order = await pool.query(`select * 
                from orders
                where owner_id = $1 and states = 'draft'`, [req.session.user_id])
                if (search_order.rows == '') {

                    res.render("edit_dia_chi", {
                        name: req.session.name,
                        address: address.rows,
                        quantity_foods: [{'count': 0}],
                        errors: errors
                    });
                }else{
    
                    const quantity_foods = await pool.query(`SELECT COUNT (food_id)
                    FROM order_items
                    where order_id = $1
                    GROUP BY order_id = $2`, [search_order.rows[0]['id'], search_order.rows[0]['id']])
        
                    res.render("edit_dia_chi", {
                        name: req.session.name,
                        address: address.rows,
                        quantity_foods: quantity_foods.rows,
                        errors: errors
                    });
                }
            }else{
                const all_address = await pool.query(`select * from addresses where user_id = $1`, [req.session.user_id]);
                if(search_order.rows != ''){
                    const quantity_foods = await pool.query(`SELECT COUNT (food_id)
                    FROM order_items
                    where order_id = $1
                    GROUP BY order_id = $2`, [search_order.rows[0]['id'], search_order.rows[0]['id']])
                    
                    if(req.body.address_default == 'on'){
                        for(var i=0; i<all_address.rows.length; i++){
                            console.log('address_default = ', all_address.rows[i]['address_default'])
                            if(all_address.rows[i]['address_default'] == true){
                                console.log('all_address = ', all_address.rows)
                                const update_address_default = await pool.query(`update addresses
                                set address_default = false
                                where id = $1`, [all_address.rows[i]['id']])
                            }
                        } 

                        const update_address = await pool.query(`update addresses
                                set provinceid = $1, districtid = $2, wardid=$3, name=$4, phone=$5, address_default=true, street=$6
                                where id = $7`, [req.body.calc_shipping_provinces, req.body.calc_shipping_district,req.body.ward, req.body.name,req.body.phone,req.body.street,req.params.id])
                        console.log('Cập nhật địa chỉ thành công')
                        res.redirect('/show_dia_chi')
                    }else{
                        const update_address = await pool.query(`update addresses
                        set provinceid = $1, districtid = $2, wardid=$3, name=$4, phone=$5, address_default=false, street=$6
                        where id = $7`, [req.body.calc_shipping_provinces, req.body.calc_shipping_district,req.body.ward, req.body.name,req.body.phone,req.body.street,req.params.id])
                        console.log('Cập nhật địa chỉ thành công')
                        res.redirect('/show_dia_chi')
                    }
                }else{

                    if(req.body.address_default == 'on'){
                        for(var i=0; i<all_address.rows.length; i++){
                            if(all_address.rows[i]['address_default'] == true){
                                const update_address_default = await pool.query(`update addresses
                                set address_default = false
                                where id = $1`, [all_address.rows[i]['id']])
                            }
                        } 

                        const update_address = await pool.query(`update addresses
                        set provinceid = $1, districtid = $2, wardid=$3, name=$4, phone=$5, address_default=true, street=$6
                        where id = $7`, [req.body.calc_shipping_provinces, req.body.calc_shipping_district,req.body.ward, req.body.name,req.body.phone,req.body.street,req.params.id])
                        console.log('Cập nhật địa chỉ thành công')
                        res.redirect('/show_dia_chi')
                    }else{
                        const update_address = await pool.query(`update addresses
                        set provinceid = $1, districtid = $2, wardid=$3, name=$4, phone=$5, address_default=false, street=$6
                        where id = $7`, [req.body.calc_shipping_provinces, req.body.calc_shipping_district,req.body.ward, req.body.name,req.body.phone,req.body.street,req.params.id])
                        console.log('Cập nhật địa chỉ thành công')
                        res.redirect('/show_dia_chi')
                    }
                }
            }

        }
    })

    //route xóa address
    app.get('/del_address/:id', urlencodedParser, async (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            const del_wishlist = await pool.query(`DELETE FROM addresses WHERE id = $1`,[req.params.id]);
            res.redirect("/show_dia_chi")
        }
    })

    //route xóa danh mục sản phẩm
    app.get('/del_category/:id', urlencodedParser, (req, res) => {
        pool.connect(function(err,client, done){
            if(err){
                throw err;
            }
            pool.query(`DELETE FROM category WHERE id = $1`, [req.params.id], (err, result)=>{
                if(err){
                    throw err;
                }

                console.log('xóa thành công');
                res.redirect('/category_dashboard');
            })
        })
    }) 
    //route trang chủ admin
    app.get('/product_dashboard', (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            pool.connect(function(err, client, done){
                if(err){
                    return console.error('error fetching client from pool ', err)
                }
                client.query(`select foods.id, foods.category_id, foods.name, foods.description, foods.price, foods.images, category.name as category_name
                from foods, category
                WHERE foods.category_id = category.id`, (err, result) => {
                    done();
                
                    if(err){
                        res.end();
                        return console.error('error running query ', err)
                    }
                    console.log('foods = ', result.rows);
                    res.render('product_dashboard', {
                        data: result.rows,
                        name: req.session.name, 
                        email: req.session.email
                    });
                });
            });
        }
    })  

    //route chỉnh sửa danh mục trong admin
    app.get('/edit_category/:id', urlencodedParser, async(req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{

            const category = await pool.query(`select * from category where id = $1`, [req.params.id])
            res.render('category_dashboard_edit', {
                category: category.rows,
                name: req.session.name,
                email: req.session.email
            })
        }
    })
    
    //route chỉnh sửa danh mục trong admin
    app.post('/edit_category/:id', urlencodedParser, async(req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{

            const category = await pool.query(`update category
            set name = $1 , description=$2
            where id = $3;`, [req.body.name, req.body.description, req.params.id])
            console.log('cập nhật thành công')
            res.redirect('/category_dashboard')
        }
    })
    
    //chỉnh sửa thông tin ng dùng
    app.get('/edit_users/:id', urlencodedParser, async(req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{

            const user = await pool.query(`select * from users where id = $1`, [req.params.id])
            res.render('customer_dashboard_edit', {
                user: user.rows,
                name: req.session.name,
                email: req.session.email
            })
        }
    })
    
    //route chỉnh sửa người dùng
    app.post('/edit_users/:id', urlencodedParser, async(req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            
            const category = await pool.query(`update users
            set name = $1 , phone=$2
            where id = $3;`, [req.body.name, req.body.phone, req.params.id])
            console.log('cập nhật thành công')
            res.redirect('/customer_dashboard')
        }
    })

    
    //route xem các order của admin
    app.get('/order_dashboard', urlencodedParser, async(req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{

            const orders = await pool.query(`select orders.id, orders.owner_id, orders.delivery_time, orders.delivery_fee, orders.discount, orders.amount, orders.states, addresses.street, addresses.wardid, addresses.districtid, addresses.provinceid
            from orders, addresses
            where orders.address_id = addresses.id`)
            console.log('orders = ', orders.rows)
            res.render('orders_dashboard', {
                orders: orders.rows,
                name: req.session.name,
                email: req.session.email
            })
        }
    })
    //route lấy form chỉnh sửa order của admin
    app.get('/edit_order_dashboard/:id', urlencodedParser,async (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            const order = await pool.query(`select orders.id, orders.address_id, orders.owner_id, orders.delivery_time, orders.delivery_fee, orders.discount, orders.amount, orders.states, addresses.street, addresses.wardid, addresses.districtid, addresses.provinceid
            from orders, addresses
            where orders.address_id = addresses.id and orders.id = $1`, [req.params.id])
            const order_items = await pool.query(`select *
            from order_items
            where order_id = $1`, [req.params.id])
            const owner_order = await pool.query(`select * from users where id = $1`, [order.rows[0]['owner_id']])
            const address = await pool.query(`select * from addresses where id = $1`, [order.rows[0]['address_id']])
            const foods = await pool.query(`select * from foods`)
            res.render('orders_dashboard_edit', {
                name: req.session.name, 
                email: req.session.email,
                user_id: req.session.user_id,
                order: order.rows,
                order_items: order_items.rows,
                owner_order: owner_order.rows,
                address: address.rows,
                foods: foods.rows
            })
        }
    })

    //route lấy form địa chỉ của admin
    app.get('/addresses_dashboard', urlencodedParser, async(req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{

            const addresses = await pool.query(`select *
            from addresses`)
            console.log('address = ', addresses.rows)
            res.render('address_dashboard', {
                addresses: addresses.rows,
                name: req.session.name,
                email: req.session.email
            })
        }
    })
      
    //route lấy form thêm địa chỉ của admin
    app.get('/address_dashboard_add', async (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            const users = await pool.query(`select * from users where roles = 1`)
            let errors = []
            res.render("address_dashboard_add", {
                users: users.rows,
                name: req.session.name,
                email: req.session.email,
                errors: errors
            });
        }
    }) 
      
    //route kiểm tra, thêm địa chỉ của admin
    app.post('/address_dashboard_add', urlencodedParser, async (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            const users = await pool.query(`select * from users where roles = 1`)
            var regex = /^((09|03|07|08|05)+([0-9]{8})\b)$/
            let errors = []
            console.log('phone = ',req.body.phone)
            console.log('typeof phone = ',typeof req.body.phone)
            console.log('test = ',regex.test(req.body.phone))
            if(regex.test(req.body.phone) != true){
                errors.push({message: "Phone invalid!"})
                res.render("address_dashboard_add", {
                    users: users.rows,
                    name: req.session.name,
                    email: req.session.email,
                    errors: errors
                });
            }else{
                console.log('hello mấy cưng')
                if(req.body.address_default == 'on'){
                    const all_address = await pool.query(`select * from addresses where user_id = $1`, [req.body.user_id])
                    for(var i=0; i<all_address.rows.length; i++){
                        console.log('address_default = ', all_address.rows[i]['address_default'])
                        if(all_address.rows[i]['address_default'] == true){
                            console.log('all_address = ', all_address.rows)
                            const update_address_default = await pool.query(`update addresses
                            set address_default = false
                            where id = $1`, [all_address.rows[i]['id']])
                        }
                    }
                    
                    const add_address = await pool.query(`insert into addresses (user_id, address_default, phone, name, wardid, districtid, provinceid, street)
                    values ($1,$2,$3,$4,$5,$6,$7,$8);`, [req.body.user_id,true,req.body.phone,req.body.name,req.body.wardid,req.body.calc_shipping_district,req.body.calc_shipping_provinces,req.body.street])
                    console.log('Thêm địa chỉ vào thành công')
                    res.redirect('/addresses_dashboard')
                }else{
                    const add_address = await pool.query(`insert into addresses (user_id, address_default, phone, name, wardid, districtid, provinceid, street)
                    values ($1,$2,$3,$4,$5,$6,$7,$8);`, [req.body.user_id,false,req.body.phone,req.body.name,req.body.wardid,req.body.calc_shipping_district,req.body.calc_shipping_provinces,req.body.street])
                    console.log('Thêm địa chỉ vào thành công')
                    res.redirect('/addresses_dashboard')
                }
            }
        }
    }) 

    //route lấy form chỉnh sửa địa chỉ của admin
    app.get('/edit_address_dashboard/:id', urlencodedParser,async (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            const address = await pool.query(`select * FROM addresses WHERE id = $1`, [req.params.id])

            res.render('address_dashboard_edit', {
                name: req.session.name, 
                email: req.session.email,
                user_id: req.session.user_id,
                address: address.rows
            })
        }
    })

    //route kiểm tra, chỉnh sửa địa chỉ của admin
    app.post('/edit_address_dashboard/:id', urlencodedParser, async (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            const address = await pool.query(`select * FROM addresses WHERE id = $1`, [req.params.id])
            var regex = /^((09|03|07|08|05)+([0-9]{8})\b)$/
            let errors = []
            if(regex.test(req.body.phone) != true){
                errors.push({message: "Phone invalid!"})
                
                res.render("edit_dia_chi", {
                    name: req.session.name,
                    address: address.rows,
                    email: req.session.email,
                    errors: errors
                });
            }else{
                
                const all_address_tmp = await pool.query(`select * from addresses where id = $1`,[req.params.id]);
                // console.log('all_address_tmp = ', all_address_tmp.rows)
                const all_address = await pool.query(`select * from addresses where user_id = $1`, [all_address_tmp.rows[0]['user_id']])
                console.log('vào check nè')
                if(req.body.address_default == 'on'){
                    console.log('checked')
                    for(var i=0; i<all_address.rows.length; i++){
                        console.log('address_default = ', all_address.rows[i]['address_default'])
                        if(all_address.rows[i]['address_default'] == true){
                            console.log('all_address = ', all_address.rows)
                            const update_address_default = await pool.query(`update addresses
                            set address_default = false
                            where id = $1`, [all_address.rows[i]['id']])
                        }
                    } 

                    const update_address = await pool.query(`update addresses
                    set provinceid = $1, districtid = $2, wardid=$3, name=$4, phone=$5, address_default=true, street=$6
                    where id = $7`, [req.body.calc_shipping_provinces, req.body.calc_shipping_district,req.body.ward, req.body.name,req.body.phone,req.body.street,req.params.id])
                    console.log('Cập nhật địa chỉ thành công')
                    res.redirect('/addresses_dashboard')
                }else{
                    const update_address = await pool.query(`update addresses
                    set provinceid = $1, districtid = $2, wardid=$3, name=$4, phone=$5, address_default=false, street=$6
                    where id = $7`, [req.body.calc_shipping_provinces, req.body.calc_shipping_district,req.body.ward, req.body.name,req.body.phone,req.body.street,req.params.id])
                    console.log('Cập nhật địa chỉ thành công')
                    res.redirect('/addresses_dashboard')
                }
            }
        }
    })

    //route xóa địa chỉ của admin
    app.get('/del_address_dashboard/:id', urlencodedParser, async (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            const del_wishlist = await pool.query(`DELETE FROM addresses WHERE id = $1`,[req.params.id]);
            res.redirect("/addresses_dashboard")
        }
    })

    //route kiểm tra, thêm danh mục của admin
    app.post('/category_add', urlencodedParser, upload.single('image'),async (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            pool.query(`INSERT INTO category (name, description)
                VALUES ($1,$2);`,
                [req.body.name, req.body.description], (err, result)=>{
                    if(err){
                        throw err;
                    }
                    console.log('Thêm thành công')
                    res.redirect('/category_dashboard');
                });
            
        }
    })
    
    //route lấy form thêm sản phẩm của admin
    app.get('/product_add', (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            pool.connect(function(err,client, done){
                if(err){
                    throw err;
                }
                pool.query(`SELECT * FROM category`,(err, result)=>{
                    if(err){
                        throw err;
                    }

                    console.log('kết quả = ', result.rows);
                    res.render("product_add", {data: result.rows, name: req.session.name, email: req.session.email});
                })
            })
        }
    })  
    //route thêm sản phẩm của admin
    app.post('/pro_add', urlencodedParser, upload.single('image'),async (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            console.log('id = ',req.body.category)
            const imagePath = path.join(__dirname, '../public/images/');
            const fileUpload = new Resize(imagePath);
            if (!req.file) {
                // res.status(401).json({error: 'Please provide an image'});
                pool.query(`INSERT INTO foods (name, description, category_id, price, images)
                VALUES ($1,$2,$3,$4,$5);`,
                [req.body.name, req.body.description, req.body.category, req.body.price, ''], (err, result)=>{
                    if(err){
                        throw err;
                    }
                    console.log('Thêm thành công')
                    res.redirect('/product_dashboard');
                });
            }else{
                const filename = await fileUpload.save(req.file.buffer);
                pool.query(`INSERT INTO foods (name, description, category_id, price, images)
                VALUES ($1,$2,$3,$4,$5);`,
                [req.body.name, req.body.description, req.body.category, req.body.price, 'images/'+filename], (err, result)=>{
                    if(err){
                        throw err;
                    }
                    console.log('Thêm thành công')
                    res.redirect('/product_dashboard');
                });
            }
        }
    })
    //route danh mục sản phẩm của admin
    app.get('/category_dashboard', (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            pool.connect(function(err, client, done){
                if(err){
                    return console.error('error fetching client from pool ', err)
                }
                client.query(`select * from category`, (err, result) => {
                    done();
                
                    if(err){
                        res.end();
                        return console.error('error running query ', err)
                    }
                    console.log('category = ', result.rows);
                    res.render('category_dashboard', {
                        data: result.rows,
                        name: req.session.name, 
                        email: req.session.email
                    });
                });
            });
        }
    })  
    //route thêm danh mục sản phẩm của admin
    app.get('/category_dashboard_add', (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            res.render("category_dashboard_add", {name: req.session.name});
        }
    })  
    //route thông tin người dùng của admin
    app.get('/customer_dashboard', urlencodedParser, async (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            const users = await pool.query(`select * from users where roles = 1`);
            res.render("customer_dashboard", {
                users: users.rows,
                email: req.session.email,
                name: req.session.name
            });
        }
    })  
    app.get('/customer_dashboard_add', (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            res.render("customer_dashboard_add", {name: req.session.name});
        }
    }) 

    //route lấy thông tin ng dùng
    app.get('/information_user', urlencodedParser, async(req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            const information_user = await pool.query(`select * from users where id = $1`, [req.session.user_id])
            
            const search_order = await pool.query(`select * 
            from orders
            where owner_id = $1 and states = 'draft'`, [req.session.user_id])
            if (search_order.rows == '') {
            
                res.render('information_user', {
                    data: information_user.rows, 
                    name: req.session.name, 
                    user_id: req.session.user_id,
                    quantity_foods: [{"count": 0}]
                })
            }else{
                const quantity_foods = await pool.query(`SELECT COUNT (food_id)
                FROM order_items
                where order_id = $1
                GROUP BY order_id = $2`, [search_order.rows[0]['id'], search_order.rows[0]['id']])
    
                res.render('information_user', {
                    data: information_user.rows, 
                    name: req.session.name, 
                    user_id: req.session.user_id,
                    quantity_foods: quantity_foods.rows
                })
            }
        }
    }) 

    //route lấy form quên mật khẩu
    app.get('/quen_mat_khau', urlencodedParser,async (req, res) => {
        if(typeof req.session.name != 'undefined'){
            const search_order = await pool.query(`select * 
            from orders
            where owner_id = $1 and states = 'draft'`, [req.session.user_id])
            let errors = []
            if (search_order.rows == ''){
                    
                res.render("quen_mat_khau", {
                    name: req.session.name,
                    errors: errors,
                    quantity_foods: [{"count": 0}]
                });
            }else{
                const quantity_foods = await pool.query(`SELECT COUNT (food_id)
                FROM order_items
                where order_id = $1
                GROUP BY order_id = $2`, [search_order.rows[0]['id'], search_order.rows[0]['id']])
        
                res.render("quen_mat_khau", {
                    name: req.session.name,
                    errors: errors,
                    quantity_foods: quantity_foods.rows
                });
            }

        }else{
            res.redirect('/login')
        }
    
    }) 

    //route đổi mật khẩu
    app.post('/quen_mat_khau', urlencodedParser, async (req, res) => {
        if(typeof req.session.name != 'undefined'){
            const search_order = await pool.query(`select * 
            from orders
            where owner_id = $1 and states = 'draft'`, [req.session.user_id])
            const users = await pool.query(`select * from users where id = $1`, [req.session.user_id])
            let errors = []
            //kiểm tra mật khẩu mới và mật khẩu lặp lại
            if(req.body.new_password != req.body.confirm_password){
                errors.push({new_confirm: "Confirm password don't match!"})
                if (search_order.rows == ''){
                    
                    res.render("quen_mat_khau", {
                        name: req.session.name,
                        errors: errors,
                        quantity_foods: [{"count": 0}]
                    });
                }else{
                    const quantity_foods = await pool.query(`SELECT COUNT (food_id)
                    FROM order_items
                    where order_id = $1
                    GROUP BY order_id = $2`, [search_order.rows[0]['id'], search_order.rows[0]['id']])
            
                    res.render("quen_mat_khau", {
                        name: req.session.name,
                        errors: errors,
                        quantity_foods: quantity_foods.rows
                    });
                }
            }else if (!bcrypt.compareSync(req.body.old_password, users.rows[0]['password'])){
                errors.push({new_confirm: "Password don't match!"})
                if (search_order.rows == ''){
                    
                    res.render("quen_mat_khau", {
                        name: req.session.name,
                        errors: errors,
                        quantity_foods: [{"count": 0}]
                    });
                }else{
                    const quantity_foods = await pool.query(`SELECT COUNT (food_id)
                    FROM order_items
                    where order_id = $1
                    GROUP BY order_id = $2`, [search_order.rows[0]['id'], search_order.rows[0]['id']])
            
                    res.render("quen_mat_khau", {
                        name: req.session.name,
                        errors: errors,
                        quantity_foods: quantity_foods.rows
                    });
                }
            }else{
                let hashed_password = await bcrypt.hash(req.body.new_password, 10);
                pool.query(
                    'SELECT * FROM users WHERE id = $1',[req.session.user_id],async (err, result) => {
                        if (err){
                            throw err;
                        }
                        const update_pass = await pool.query(`update users
                        set password = $1
                        where id = $2`, [hashed_password, req.session.user_id])
                        res.redirect('/logout');
                    }
                )
            }
        }else{
            res.redirect('/login')
        }
    
    }) 
    //route show tất cả địa chỉ của KH
    app.get('/show_dia_chi', urlencodedParser,async (req, res) => {
        if(typeof req.session.name != 'undefined'){
            const search_order = await pool.query(`select * 
            from orders
            where owner_id = $1 and states = 'draft'`, [req.session.user_id])
            const list_address = await pool.query(`select * from addresses where user_id = $1`, [req.session.user_id])
            if (search_order.rows == ''){
                res.render("show_dia_chi", {
                    name: req.session.name,
                    quantity_foods: [{'count': 0}],
                    list_address: list_address.rows
                });
            }else{
                const quantity_foods = await pool.query(`SELECT COUNT (food_id)
                FROM order_items
                where order_id = $1
                GROUP BY order_id = $2`, [search_order.rows[0]['id'], search_order.rows[0]['id']])
        
                res.render("show_dia_chi", {
                    name: req.session.name,
                    quantity_foods: quantity_foods.rows,
                    list_address: list_address.rows
                });
            }
        }else{
            res.redirect("/login");
        }
        
    }) 
}

module.exports = route