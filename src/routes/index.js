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
const { response } = require('express');
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
                roles: req.session.roles,
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
                    roles: req.session.roles,
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
                    roles: req.session.roles,
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
    app.post('/update/:id', urlencodedParser, async (req, res) => {
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
    
                    pool.query(`select * from users where email = $1`, [req.session.email], async (err, result)=>{
                        if(err){
                            throw err;
                        }

                        const search_order = await pool.query(`select * 
                        from orders
                        where owner_id = $1 and states = 'draft'`, [req.session.user_id])
                        //Nếu đơn hàng chưa có sản phẩm thì SL hiển thị là 0 và ngược lại
                        if (search_order.rows == '') {
                        
                            res.render('information_user', {
                                data: result.rows,
                                errors: errors, 
                                name: req.session.name, 
                                user_id: req.session.user_id,
                                roles: req.session.roles,
                                quantity_foods: [{"count": 0}]
                            })
                        }else{
                            //đếm sản phẩm trong giỏ hàng
                            const quantity_foods = await pool.query(`SELECT COUNT (food_id)
                            FROM order_items
                            where order_id = $1
                            GROUP BY order_id = $2`, [search_order.rows[0]['id'], search_order.rows[0]['id']])
                        
                            res.render('information_user', {
                                data: result.rows, 
                                quantity_foods: quantity_foods.rows,
                                errors: errors, 
                                name: req.session.name, 
                                roles: req.session.roles,
                                user_id: req.session.user_id})
                        }
                        
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
                    roles: req.session.roles,
                    name: req.session.name
                })
            }else{
                const quantity_foods = await pool.query(`SELECT COUNT (food_id)
                FROM order_items
                where order_id = $1
                GROUP BY order_id = $2`, [search_order.rows[0]['id'], search_order.rows[0]['id']])
    
                res.render("about", {
                    name: req.session.name,
                    roles: req.session.roles,
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
                    roles: req.session.roles,
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
                    roles: req.session.roles,
                    category: category.rows
                });
            }
        }else{
            res.render("blog", {
                name: req.session.name,
                roles: req.session.roles,
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
                    roles: req.session.roles,
                    quantity_foods: [{'count': 0}]
                });
            }else{
                const quantity_foods = await pool.query(`SELECT COUNT (food_id)
                FROM order_items
                where order_id = $1
                GROUP BY order_id = $2`, [search_order.rows[0]['id'], search_order.rows[0]['id']])

                res.render("new_address", {
                    name: req.session.name,
                    roles: req.session.roles,
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
                        roles: req.session.roles,
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
                        roles: req.session.roles,
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
                    roles: req.session.roles,
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
                    roles: req.session.roles,
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
                //Trừ 1 sp vào giỏ hàng
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
            const qty_food_in_inventory = await pool.query(`select * from inventory where food_id = $1`, [get_quantity.rows[0]['food_id']])
            
            // let errors = []
            // if(get_quantity.rows[0]['quantity'] > qty_food_in_inventory.rows[0]['quantity']){
            //     errors.push([{
            //         "code": 400,
            //         "message": "The product is out of stock!"
            //     }])
            // }else{

                //Cộng 1 sp vào giỏ hàng
                const update_quantity = await pool.query(`update order_items
                set quantity = $1
                where id=$2`,[get_quantity.rows[0]['quantity']+1, req.params.order_item_id]);
                res.redirect("/cart")
            // }
        }
    })

    //route xác nhận địa chỉ giao hàng
    app.get('/approve_address/:address_id&:order_id', urlencodedParser, async (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            console.log('address_id = ', req.params.address_id, ' order_id = ', req.params.order_id)
            //Cập nhật địa chỉ giao hàng
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
            //xóa địa chỉ giao hàng
            const del_address = await pool.query(`DELETE FROM addresses WHERE id = $1`,[req.params.id]);
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
                    roles: req.session.roles,
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
                    roles: req.session.roles,
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
            var owner_order, address;
            if(order.length > 0){
                owner_order = await pool.query(`select * from users where id = $1`, [order.rows[0]['owner_id']])
                address = await pool.query(`select * from addresses where id = $1`, [order.rows[0]['address_id']])
            }else{
                //Kiểm tra nếu khách hàng có địa chỉ mặc định thì set địa chỉ vào giỏ hàng
                const order_tmp = await pool.query(`select * from orders where id = $1`, [req.params.id])
                if(order_tmp.rows[0]['states'] == 'draft' && order_tmp.rows[0]['address_id'] == null){
                    const get_address_default = await pool.query(`select * from addresses where user_id = $1 and address_default = true`, [req.session.user_id])
                    if(get_address_default.rows.length >0){
                        const add_adress_default = await pool.query(`update orders
                        set address_id = $1
                        where id=$2`, [get_address_default.rows[0]['id'], req.params.id])
                    }
                }
                const order_tmp_new = await pool.query(`select * from orders where id = $1`, [req.params.id])
                owner_order = await pool.query(`select * from users where id = $1`, [order_tmp_new.rows[0]['owner_id']])
                address = await pool.query(`select * from addresses where id = $1`, [order_tmp_new.rows[0]['address_id']])
            }
            
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
                    roles: req.session.roles,
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
                    roles: req.session.roles,
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
                    //Kiểm tra tổng tiền nếu lớn hơn 350,000 VNĐ sẽ miễn phí vận chuyển       
                    let total = 0
                    for(var i=0; i<order_items.rows.length; i++){
                        total += (order_items.rows[i]['quantity'] * order_items.rows[i]['price'])
                    }
    
                    let discount = 1
                    if(total >= 350000){
                        discount = 0
                    }
                    if(search_order.rows[0]['address_id'] != null){
                        
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
                                roles: req.session.roles,
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
                                roles: req.session.roles,
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
                            const address = await pool.query(`select * from addresses where id = $1`, [search_order_new.rows[0]['address_id']])
                            console.log('search_order_new = ', search_order_new.rows)
                            console.log('address = ', address.rows)
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
                                    roles: req.session.roles,
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
                                    roles: req.session.roles,
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
                                    roles: req.session.roles,
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
                                    roles: req.session.roles,
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
                        roles: req.session.roles,
                        errors: errors
                    });
                }
            }else{
                res.render("cart", {
                    cart_user: cart_user.rows, 
                    name: req.session.name,
                    quantity_foods: [{"count": 0}],
                    roles: req.session.roles,
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
            //Lấy thông tin đơn hàng
            const order = await pool.query(`select * from order_items where id $1`,[req.params.id])
            //Lấy số lượng sản phẩm trong kho theo id
            const qty = await pool.query(`select * from iventory where food_id = $1`, [req.params.id])
            //update inventory
            const qty_food = await pool.query(`update inventory 
            set quantity = $1
            where id = $2`,[Number(qty.rows[0]['quantity']) + Number(order.rows[0]['quantity']), qty.rows[0]['id']])
            //Xóa sản phẩm ra khỏi giỏ hàng
            const del_pro_cart = await pool.query(`DELETE FROM order_items WHERE id = $1`,[req.params.id])
            console.log('xóa sản phẩm trong giỏ thành công')
            res.redirect('/cart')
        }
    })

    //route thêm sản phẩm vào giỏ hàng
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

            const qty_food_in_inventory = await pool.query(`select * from inventory where food_id = $1`, [req.params.id])
            //kiểm tra sản phẩm trong kho
            let errors = []
            if(Number(qty_food_in_inventory.rows[0]['quantity']) - 1 < 0){
                const product_single = await pool.query(`select * from foods where id = $1`, [req.params.id])
                const search_order = await pool.query(`select * 
                from orders
                where owner_id = $1 and states = 'draft'`, [req.session.user_id])
                
                errors.push({code: 400, message: "The product is out of stock!"})
                console.log('errors = ', errors)
                if (search_order.rows == '') {
                    res.render('product-single', {
                        data: product_single.rows,
                        quantity_foods: [{"count": 0}],
                        name: req.session.name,
                        roles: req.session.roles,
                        errors: errors
                    })
                }else{
                    const quantity_foods = await pool.query(`SELECT COUNT (food_id)
                    FROM order_items
                    where order_id = $1
                    GROUP BY order_id = $2`, [search_order.rows[0]['id'], search_order.rows[0]['id']])
        
                    res.render('product-single', {
                        data: product_single.rows,
                        name: req.session.name,
                        quantity_foods: quantity_foods.rows,
                        roles: req.session.roles,
                        errors: errors
                    })
                }
            }else{
                /*
                Khi add sản phẩm vào giỏ hàng, kiểm tra sp đó có trong giỏ hàng chưa
                Nếu có sẽ tăng số lượng sản phẩm lên 1
                nếu chưa có sẽ thêm vào giỏ hàng
                */
                for(var i=0; i<order_items.rows.length; i++){
                    if(req.params.id == order_items.rows[i]['food_id']){
                        console.log('có trong order_item')
                        flag_order_items = 1
                    }
                }
                // kiểm tra sản phẩm có tồn tại trong giỏ hàng chưa
                if(flag_order_items > 0){
                    quantity_new = Number(order_items.rows[0]['quantity']) + Number(1)
                    const update_quantity = await pool.query(`update order_items
                    set quantity = $1
                    where food_id = $2;`,[quantity_new, req.params.id]);
                    const qty_food = await pool.query(`select * from inventory where food_id = $1`, [req.params.id])
                    const update_inventory = await pool.query(`update inventory
                    set quantity = $1
                    where id = $2`,[Number(qty_food.rows[0]['quantity']) - 1, qty_food.rows[0]['id']])


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
                        
                        const search_food = await pool.query(`select * from foods where id = $1`, [req.params.id])
                        const price_food = search_food.rows
                        //Thêm sản phẩm vào giỏ hàng
                        const add_to_cart = await pool.query(`insert into order_items (order_id, food_id, quantity, price)
                        values ($1,$2,1,$3);`, [order_new[0]['id'], req.params.id, price_food[0]['price']])
                        //cập nhật kho
                        const qty_food = await pool.query(`select * from inventory where food_id = $1`, [req.params.id])
                        const update_inventory = await pool.query(`update inventory
                        set quantity = $1
                        where id = $2`,[Number(qty_food.rows[0]['quantity']) - 1, qty_food.rows[0]['id']])

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
                        //Thêm sản phẩm vào giỏ hàng
                        const add_to_cart = await pool.query(`insert into order_items (order_id, food_id, quantity, price)
                        values ($1,$2,1,$3);`, [order_new[0]['id'], req.params.id, price_food[0]['price']])
                        //cập nhật kho
                        const qty_food = await pool.query(`select * from inventory where food_id = $1`, [req.params.id])
                        const update_inventory = await pool.query(`update inventory
                        set quantity = $1
                        where id = $2`,[Number(qty_food.rows[0]['quantity']) - 1, qty_food.rows[0]['id']])
                        res.redirect('/shop/0')
                    }
                }
            }
        }
    })

    //route xem chi tiết blog
    app.get('/blog-single', (req, res) => {
        res.render("blog-single", {name: req.session.name});
    })             
    //route xác nhận thanh toán

    app.get('/checkout/', urlencodedParser, async(req, res)=>{
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            //danh sách resultCode của momo
            var MOMO_MESSAGES = {
                '0': 'Giao dịch thành công.',
                '9000': 'Giao dịch đã được xác nhận thành công.',
                '8000': 'Giao dịch đang ở trạng thái cần được người dùng xác nhận thanh toán lại.',
                '7000': 'Giao dịch đang được xử lý.',
                '1000': 'Giao dịch đã được khởi tạo, chờ người dùng xác nhận thanh toán.',
                '11': 'Truy cập bị từ chối.',
                '12': 'Phiên bản API không được hỗ trợ cho yêu cầu này.',
                '13': 'Xác thực doanh nghiệp thất bại.',
                '20': 'Yêu cầu sai định dạng.',
                '21': 'Số tiền giao dịch không hợp lệ.',
                '40': 'RequestId bị trùng.',
                '41': 'OrderId bị trùng.',
                '42': 'OrderId không hợp lệ hoặc không được tìm thấy.',
                '43': 'Yêu cầu bị từ chối vì xung đột trong quá trình xử lý giao dịch.',
                '1001': 'Giao dịch thanh toán thất bại do tài khoản người dùng không đủ tiền.',
                '1002': 'Giao dịch bị từ chối do nhà phát hành tài khoản thanh toán.',                    '1003': 'Giao dịch bị đã bị hủy.',
                '1004': 'Giao dịch thất bại do số tiền thanh toán vượt quá hạn mức thanh toán của người dùng.',
                '1005': 'Giao dịch thất bại do url hoặc QR code đã hết hạn.',
                '1006': 'Giao dịch thất bại do người dùng đã từ chối xác nhận thanh toán.',
                '1007': 'Giao dịch bị từ chối vì tài khoản người dùng đang ở trạng thái tạm khóa.',
                '1026': 'Giao dịch bị hạn chế theo thể lệ chương trình khuyến mãi.',
                '1080': 'Giao dịch hoàn tiền bị từ chối. Giao dịch thanh toán ban đầu không được tìm thấy.',
                '1081': 'Giao dịch hoàn tiền bị từ chối. Giao dịch thanh toán ban đầu có thể đã được hoàn.',
                '2001': 'Giao dịch thất bại do sai thông tin liên kết.',
                '2007': 'Giao dịch thất bại do liên kết hiện đang bị tạm khóa.',
                '3001': 'Liên kết thất bại do người dùng từ chối xác nhận.',
                '3002': 'Liên kết bị từ chối do không thỏa quy tắc liên kết.',
                '3003': 'Hủy liên kết bị từ chối do đã vượt quá số lần hủy.',
                '3004': 'Liên kết này không thể hủy do có giao dịch đang chờ xử lý.',
                '4001': 'Giao dịch bị hạn chế do người dùng chưa hoàn tất xác thực tài khoản.',
                '4010': 'Quá trình xác minh OTP thất bại.',
                '4011': 'OTP chưa được gửi hoặc hết hạn.',
                '4100': 'Giao dịch thất bại do người dùng không đăng nhập thành công.',
                '4015': 'Quá trình xác minh 3DS thất bại.',
                '10': 'Hệ thống đang được bảo trì.',
                '99': 'Lỗi không xác định.'
            }
            
            console.log('hello mấy cưng')
            console.log('request query = ', req.query)
            var status = req.query.resultCode
            if(Number(status) == 0 || Number(status) == 9000){
                //Nếu thanh toán thành công sẽ cập nhật đơn hàng
                var output = req.query.orderInfo.split(' ')
                const confirm_order = await pool.query(`update orders
                set states = 'done'
                where id = $1;`, [output[6]])
                res.redirect('/order_details/'+output[6])
            }else{
                //Nếu thanh toán không thành công sẽ báo lỗi
                let errors = []
                let alert = require('alert');
                errors.push({errors: MOMO_MESSAGES[status]})
                console.log('errors = ', errors)
                var err = 'Errors: \n'+MOMO_MESSAGES[status]
                alert(message=err)
                res.redirect('/cart')
            }
        }
    })

    app.post('/checkout', urlencodedParser, async(req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            
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
                
                if(typeof req.body.discount != 'undefined'){
                    const confirm_order = await pool.query(`update orders
                    set delivery_time = $1, amount = $2, discount = $3
                    where id = $4;`, [dates, req.body.amount, req.body.discount, req.body.order_id])
                    // where id = $4;`, [new Intl.DateTimeFormat().format(dates), req.body.amount, req.body.discount, req.body.order_id])
                    
                    // console.log('mua hàng thành công')
                    // res.redirect('/')
                }else{
                    const confirm_order = await pool.query(`update orders
                    set delivery_time = $1, amount = $2, discount = $3
                    where id = $4;`, [dates, req.body.amount, 0, req.body.order_id])
                    // where id = $4;`, [new Intl.DateTimeFormat().format(dates), req.body.amount, 0, req.body.order_id])
                    
                    // console.log('mua hàng thành công')
                    // res.redirect('/')
                }
                //cấu hình resquest
                var partnerCode = "MOMORKA620211221";
                var accessKey = "J7HpOQlRcCpdLEai";
                var secretkey = "tSygxGX51JafYX6SIjvTPx2T8DRymaku";
    
                var requestId = partnerCode + new Date().getTime();
                var orderId = requestId;
                var orderInfo = "Payment for the order with ID "+req.body.order_id;
                var redirectUrl = "http://localhost:5001/checkout";
                var ipnUrl = "http://localhost:5001/checkout/";
                var amount = req.body.amount;
                var requestType = "captureWallet"
                var extraData = ""; //pass empty value if your merchant does not have stores
    
                var rawSignature = "accessKey="+accessKey+"&amount=" + amount+"&extraData=" + extraData+"&ipnUrl=" + ipnUrl+"&orderId=" + orderId+"&orderInfo=" + orderInfo+"&partnerCode=" + partnerCode +"&redirectUrl=" + redirectUrl+"&requestId=" + requestId+"&requestType=" + requestType
                //puts raw signature
                console.log("--------------------RAW SIGNATURE----------------")
                console.log(rawSignature)
                //signature
                const crypto = require('crypto');
                var signature = crypto.createHmac('sha256', secretkey)
                    .update(rawSignature)
                    .digest('hex');
                console.log("--------------------SIGNATURE----------------")
                console.log(signature)
    
                //json object send to MoMo endpoint
                const requestBody = JSON.stringify({
                    partnerCode : partnerCode,
                    accessKey : accessKey,
                    requestId : requestId,
                    amount : amount,
                    orderId : orderId,
                    orderInfo : orderInfo,
                    redirectUrl : redirectUrl,
                    ipnUrl : ipnUrl,
                    extraData : extraData,
                    requestType : requestType,
                    signature : signature,
                    lang: 'en'
                });
                //Create the HTTPS objects
                const https = require('https');
                const options = {
                    hostname: 'test-payment.momo.vn',
                    port: 443,
                    path: '/v2/gateway/api/create',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(requestBody)
                    }
                }
    
                //Send the request and get the response
    
                var request = https.request(options, response => {
                    console.log(`Status: ${response.statusCode}`);
                    console.log(`Headers: ${JSON.stringify(response.headers)}`);
                    response.setEncoding('utf8');
                    response.on('data', (body) => {
                        console.log('Body: ');
                        console.log(body);
                        console.log('payUrl: ');
                        console.log(JSON.parse(body).payUrl);
                        res.redirect(JSON.parse(body).payUrl)
                    });
                    response.on('end', () => {
                        console.log('No more data in response.');
                    });
                })
                
                request.on('error', (e) => {
                    console.log(`problem with request: ${e.message}`);
                });
                // write data to request body
                console.log("Sending....")
                
                request.write(requestBody);
                request.end();
            }else{
                //Nếu chưa chọn địa chỉ giao hàng sẽ thông báo lỗi
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
                                //Tính tổng tiền đơn hàng
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
                                    roles: req.session.roles,
                                    errors: errors
                                });
                            }else{
                                //Tính tổng tiền đơn hàng
                                const totals = (Number(total) + Number(search_order.rows[0]['delivery_fee'])) - Number(search_order.rows[0]['delivery_fee'])
                                
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
                                    roles: req.session.roles,
                                    errors: errors
                                });
                            }
                        }else{
                            //kiểm tra trong user có thiết lập địa chỉ mặc định hay không
                            //nếu có thì tự động lưu vào đơn hàng, user được phép đổi địa chỉ giao hàng
                            if(get_address_default.rows.length > 0){
                                //cập nhật địa chỉ mặc định vào đơn hàng
                                const add_adress_default = await pool.query(`update orders
                                set address_id = $1
                                where id=$2`, [get_address_default.rows[0]['id'], search_order.rows[0]['id']])
                                const search_order_new = await pool.query(`select * 
                                from orders
                                where owner_id = $1 and states = 'draft'`, [req.session.user_id])
                                const address = await pool.query(`select * from addresses where id = $1`, [search_order_new.rows[0]['address_default']])
                                if(discount>0){
                                    //Tính tổng tiền đơn hàng
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
                                        roles: req.session.roles,
                                        errors: errors
                                    });
                                }else{
                                    //Tính tổng tiền đơn hàng
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
                                        roles: req.session.roles,
                                        errors: errors
                                    });
                                }
                            }else{
                                if(discount>0){
                                    //Tính tổng tiền đơn hàng
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
                                        roles: req.session.roles,
                                        errors: errors
                                    });
                                }else{
                                    //Tính tổng tiền đơn hàng
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
                                        roles: req.session.roles,
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
                            roles: req.session.roles,
                            errors: errors
                        });
                    }
                }else{
                    res.render("cart", {
                        cart_user: cart_user.rows, 
                        name: req.session.name,
                        quantity_foods: [{"count": 0}],
                        roles: req.session.roles,
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
                    roles: req.session.roles,
                    quantity_foods: quantity_foods.rows
                });
            }
        }else{
            res.render("contact", {name: req.session.name});
        }
    })      
    //route xem sản phẩm chi tiết    
    app.get('/product-single/:id', async (req, res) => {
        const product_single = await pool.query(`select * from foods where id = $1`, [req.params.id])
        const wishlist = await pool.query(`select count(*)
        from wishlist
        where user_id = $1;`, [req.params.id])
        const search_order = await pool.query(`select * 
        from orders
        where owner_id = $1 and states = 'draft'`, [req.session.user_id])
        const category_food = await pool.query(`select * from foods where category_id = $1`, [product_single.rows[0]['category_id']])
        let errors = []
        errors.push({code: 200, message: "nothing!"})
        if (search_order.rows == '') {
            res.render('product-single', {
                data: product_single.rows,
                quantity_foods: [{"count": 0}],
                name: req.session.name,
                category_food:category_food.rows,
                roles: req.session.roles,
                errors: errors
            })
        }else{
            const quantity_foods = await pool.query(`SELECT COUNT (food_id)
            FROM order_items
            where order_id = $1
            GROUP BY order_id = $2`, [search_order.rows[0]['id'], search_order.rows[0]['id']])

            res.render('product-single', {
                data: product_single.rows,
                name: req.session.name,
                quantity_foods: quantity_foods.rows,
                wishlist: wishlist.rows,
                category_food:category_food.rows,
                roles: req.session.roles,
                errors: errors
            })
        }
    })   
    
    app.post('/product-single/:id', urlencodedParser, async(req, res)=>{
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            const product_single = await pool.query(`select * from foods where id = $1`, [req.params.id])
            const order_items = await pool.query(`select order_items.id, order_items.food_id, order_items.quantity
            from orders, order_items
            where orders.id = order_items.order_id and order_items.food_id = $1 and orders.owner_id = $2 and orders.states='draft'`, [req.body.id,req.session.user_id])
            const fee_delivery = await pool.query(`select * from type_of_delivery where id = 1`)
            const qty_food_in_inventory = await pool.query(`select * from inventory where food_id = $1`, [req.body.id])
            const category_food = await pool.query(`select * from foods where category_id = $1`, [product_single.rows[0]['category_id']])
        
            var flag_order_items = 0
            var quantity_new = 0

            //kiểm tra sản phẩm trong kho
            let errors = []
            if(req.body.quantity > qty_food_in_inventory.rows[0]['quantity']){
                const product_single = await pool.query(`select * from foods where id = $1`, [req.params.id])
                const wishlist = await pool.query(`select count(*)
                from wishlist
                where user_id = $1;`, [req.params.id])
                const search_order = await pool.query(`select * 
                from orders
                where owner_id = $1 and states = 'draft'`, [req.session.user_id])
                
                errors.push({code: 400, message: "The product is out of stock!"})
                console.log('errors = ', errors)
                if (search_order.rows == '') {
                    res.render('product-single', {
                        data: product_single.rows,
                        quantity_foods: [{"count": 0}],
                        name: req.session.name,
                        category_food: category_food.rows,
                        roles: req.session.roles,
                        errors: errors
                    })
                }else{
                    const quantity_foods = await pool.query(`SELECT COUNT (food_id)
                    FROM order_items
                    where order_id = $1
                    GROUP BY order_id = $2`, [search_order.rows[0]['id'], search_order.rows[0]['id']])
        
                    res.render('product-single', {
                        data: product_single.rows,
                        name: req.session.name,
                        quantity_foods: quantity_foods.rows,
                        wishlist: wishlist.rows,
                        category_food: category_food.rows,
                        roles: req.session.roles,
                        errors: errors
                    })
                }
            }else{
                /*
                Khi add sản phẩm vào giỏ hàng, kiểm tra sp đó có trong giỏ hàng chưa
                Nếu có sẽ tăng số lượng sản phẩm lên 1
                nếu chưa có sẽ thêm vào giỏ hàng
                */
                for(var i=0; i<order_items.rows.length; i++){
                    if(req.body.id == order_items.rows[i]['food_id']){
                        console.log('có trong order_item')
                        flag_order_items = 1
                    }
                }
                
                // kiểm tra sản phẩm có tồn tại trong giỏ hàng chưa
                if(flag_order_items > 0){
                    
                    quantity_new = Number(order_items.rows[0]['quantity']) + Number(req.body.quantity)
                    const update_quantity = await pool.query(`update order_items
                    set quantity = $1
                    where food_id = $2;`,[quantity_new, req.body.id]);
                    const qty_food = await pool.query(`select * from inventory where food_id = $1`, [req.body.id])
                    const update_inventory = await pool.query(`update inventory
                    set quantity = $1
                    where id = $2`,[Number(qty_food.rows[0]['quantity']) - Number(req.body.quantity), qty_food.rows[0]['id']])

                    console.log('Cập nhật thành công')
                    res.redirect('/product-single/'+req.body.id);
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
                        
                        const search_food = await pool.query(`select * from foods where id = $1`, [req.body.id])
                        const price_food = search_food.rows
                        //Thêm sản phẩm vào giỏ hàng
                        const add_to_cart = await pool.query(`insert into order_items (order_id, food_id, quantity, price)
                        values ($1,$2,$3,$4);`, [order_new[0]['id'], req.body.id, req.body.quantity, price_food[0]['price']])
                        const qty_food = await pool.query(`select * from inventory where food_id = $1`, [req.body.id])
                        const update_inventory = await pool.query(`update inventory
                        set quantity = $1
                        where id = $2`,[Number(qty_food.rows[0]['quantity']) - Number(req.body.quantity), qty_food.rows[0]['id']])

                        console.log('Cập nhật thành công')
                        res.redirect('/product-single/'+req.body.id);
                    }else{
                        
                        const create_order = await pool.query(`insert into orders (owner_id, delivery_type_id, delivery_fee, states)
                        values ($1,2,$2,'draft');`, [req.session.user_id, fee[0]['fee']])
                        const search_order_new = await pool.query(`select * 
                        from orders
                        where owner_id = $1 and states = 'draft'`, [req.session.user_id])
                        const order_new = search_order_new.rows
                        const search_food = await pool.query(`select * from foods where id = $1`, [req.body.id])
                        const price_food = search_food.rows
                        //Thêm sản phẩm vào giỏ hàng
                        const add_to_cart = await pool.query(`insert into order_items (order_id, food_id, quantity, price)
                        values ($1,$2,$3,$4);`, [order_new[0]['id'], req.body.id, req.body.quantity, price_food[0]['price']])
                        const qty_food = await pool.query(`select * from inventory where food_id = $1`, [req.body.id])
                        const update_inventory = await pool.query(`update inventory
                        set quantity = $1
                        where id = $2`,[ Number(qty_food.rows[0]['quantity']) - Number(req.body.quantity), qty_food.rows[0]['id']])
                        
                        console.log('Cập nhật thành công')
                        res.redirect('/product-single/'+req.body.id);
                    }
                }
            }
        }
    })
               

    //route trang shop
    app.get('/shop/:id', async(req, res) =>{
        if(typeof req.session.user == 'undefined'){
            const category_id = req.params.id;
            if(category_id == 0){
                //lấy danh sách sản phẩm
                const foods = await pool.query(`SELECT * FROM foods`);
                //lấy danh sách danh mục
                const category = await pool.query(`SELECT * FROM category`);
                res.render('shop11', {foods: foods.rows, 
                    category: category.rows, 
                    name:req.session.name,
                    roles: req.session.roles,
                    category_id: category_id
                })
            }else{
                //lấy danh sách sản phẩm
                const foods = await pool.query(`SELECT * FROM foods where category_id = $1`,[category_id]);
                const category = await pool.query(`SELECT * FROM category`);
                res.render('shop11', {foods: foods.rows, 
                    category: category.rows, 
                    name:req.session.name,
                    roles: req.session.roles,
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
                        roles: req.session.roles,
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
                        roles: req.session.roles,
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
                        roles: req.session.roles,
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
                        roles: req.session.roles,
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
            //thêm sản phẩm yêu thích
        
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
            //lấy danh sách yêu thích của ng dùng
            const wishlist_user = await pool.query(`select wishlist.id,wishlist.user_id, wishlist.product_id, foods.name, foods.description, foods.category_id, foods.images, foods.price
            from wishlist, foods
            where wishlist.product_id = foods.id and wishlist.user_id = $1`,[req.session.user_id]);

            
            const search_order = await pool.query(`select * 
            from orders
            where owner_id = $1 and states = 'draft'`, [req.session.user_id])
            //lấy thông tin đơ nahnfg của người dùng. Nếu kh có sản phẩm trong đơn hàng, SL = 0
            if (search_order.rows == '') {

                console.log('wishlist = ', wishlist_user.rows)
                res.render("wishlist", {
                    wishlist: wishlist_user.rows,
                    name: req.session.name,
                    roles: req.session.roles,
                    quantity_foods: [{"count": 0}]
                });
            }else{
                // đếm số lượng trong đơn hàng
                const quantity_foods = await pool.query(`SELECT COUNT (food_id)
                FROM order_items
                where order_id = $1
                GROUP BY order_id = $2`, [search_order.rows[0]['id'], search_order.rows[0]['id']])

    
                console.log('wishlist = ', wishlist_user.rows)
                res.render("wishlist", {
                    wishlist: wishlist_user.rows,
                    name: req.session.name,
                    roles: req.session.roles,
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
            //xóa danh sách yêu thích
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
            //xóa sản phẩm
            // const del_pro_inventory = await pool.query(`delete `)
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
            
            const roles_user = await pool.query(`select * from users where id = $1`, [req.session.user_id])
            //Nếu là admin sẽ được phép truy cập link, ngược lại trả về trang chủ
            if(roles_user.rows[0]['roles'] == 1){
                res.redirect('/')
            }else{
                
                //lấy thông tin sản phẩm
                const food = await pool.query(`select * FROM foods WHERE id = $1`, [req.params.id])
                //lấy thông tin danh mục
                const category = await pool.query(`select * FROM category`)

                res.render('product_edit', {
                    data: food.rows, 
                    menu: 'edit_pro',
                    name: req.session.name, 
                    email: req.session.email,
                    roles: req.session.roles,
                    category: category.rows
                });
            }
        }
    })

    //route chỉnh sửa sản phẩm trong admin
    app.post('/edit_pro/:id', urlencodedParser,  upload.single('image'), async (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            
            const roles_user = await pool.query(`select * from users where id = $1`, [req.session.user_id])
            //Nếu là admin sẽ được phép truy cập link, ngược lại trả về trang chủ
            if(roles_user.rows[0]['roles'] == 1){
                res.redirect('/')
            }else{
                
                //lấy thông tin đường dẫn
                const imagePath = path.join(__dirname, '../public/images/');
                //Giảm kích thước ảnh
                const fileUpload = new Resize(imagePath);
                if (!req.file) {
                    //Nếu người dùng kh upload file mới thì mặc định lấy file ảnh đã lưu trước đó
                    const update_product = await pool.query(`update foods
                    set name=$1, description=$2,category_id=$3, price = $4
                    where id=$5;`, [req.body.name, req.body.description, req.body.category, req.body.price, req.params.id])

                    console.log('Cập nhật thành công')
                    res.redirect('/product_dashboard');
                }else{
                    //Lưu file vào đường dẫn set ở trên
                    const filename = await fileUpload.save(req.file.buffer);
                    //Cập nhật thông tin sản phẩm
                    const update_product = pool.query(`update foods
                    set name=$1, description=$2,category_id=$3, price = $4, images=$5
                    where id=$6;`, [req.body.name, req.body.description, req.body.category, req.body.price, 'images/'+filename, req.params.id])
                    console.log('Cập nhật thành công')
                    res.redirect('/product_dashboard');
                    
                }
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
                    roles: req.session.roles,
                    quantity_foods: [{'count': 0}]
                });
            }else{

                const quantity_foods = await pool.query(`SELECT COUNT (food_id)
                FROM order_items
                where order_id = $1
                GROUP BY order_id = $2`, [search_order.rows[0]['id'], search_order.rows[0]['id']])

                res.render("dia_chi", {
                    name: req.session.name,
                    roles: req.session.roles,
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
                //Lấy thông tin đơn hàng, nếu chưa có sản phẩm thì mặc định là 0
                if (search_order.rows == '') {

                    res.render("dia_chi", {
                        name: req.session.name,
                        quantity_foods: [{'count': 0}],
                        roles: req.session.roles,
                        errors: errors
                    });
                }else{
                    //Đếm số lượng sản phẩm trong đơn hàng
                    const quantity_foods = await pool.query(`SELECT COUNT (food_id)
                    FROM order_items
                    where order_id = $1
                    GROUP BY order_id = $2`, [search_order.rows[0]['id'], search_order.rows[0]['id']])
    
                    res.render("dia_chi", {
                        name: req.session.name,
                        quantity_foods: quantity_foods.rows,
                        roles: req.session.roles,
                        errors: errors
                    });
                }
            }else{
                console.log('address_default = ', req.body.address_default);
                //Nếu địa chỉ mới nhật vào là mặc định thì xóa dữ liệu mặc định cũ và thêm mới
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
            //lấy thông tin địa chỉ theo id
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
                    roles: req.session.roles,
                    quantity_foods: quantity_foods.rows,
                    address: address.rows
                })
            }else{
                res.render('edit_dia_chi', {
                    name: req.session.name,
                    address: address.rows,
                    roles: req.session.roles,
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
            //Kiểm tra tinh hợp lệ của sđt
            if(regex.test(req.body.phone) != true){
                errors.push({message: "Phone invalid!"})
                const search_order = await pool.query(`select * 
                from orders
                where owner_id = $1 and states = 'draft'`, [req.session.user_id])
                //lấy thông tin đơn hàng theo user nếu không có thông tin sản phẩm trong giỏ hàng, SL = 0
                if (search_order.rows == '') {

                    res.render("edit_dia_chi", {
                        name: req.session.name,
                        address: address.rows,
                        roles: req.session.roles,
                        quantity_foods: [{'count': 0}],
                        errors: errors
                    });
                }else{
                    //Đếm số lượng sản phẩm trong đơn hàng
                    const quantity_foods = await pool.query(`SELECT COUNT (food_id)
                    FROM order_items
                    where order_id = $1
                    GROUP BY order_id = $2`, [search_order.rows[0]['id'], search_order.rows[0]['id']])
        
                    res.render("edit_dia_chi", {
                        name: req.session.name,
                        address: address.rows,
                        roles: req.session.roles,
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
            //xóa địa chỉ theo id
            const del_adress = await pool.query(`DELETE FROM addresses WHERE id = $1`,[req.params.id]);
            res.redirect("/show_dia_chi")
        }
    })

    //route xóa danh mục sản phẩm
    app.get('/del_category/:id', urlencodedParser, async (req, res) => {
        
        const roles_user = await pool.query(`select * from users where id = $1`, [req.session.user_id])
        //Nếu là admin sẽ được phép truy cập link, ngược lại trả về trang chủ
        if(roles_user.rows[0]['roles'] == 1){
            res.redirect('/')
        }else{
            
            pool.connect(function(err,client, done){
                if(err){
                    throw err;
                }
                //xóa category
                pool.query(`DELETE FROM category WHERE id = $1`, [req.params.id], (err, result)=>{
                    if(err){
                        throw err;
                    }

                    console.log('xóa thành công');
                    res.redirect('/category_dashboard');
                })
            })
        }
    }) 
    
    //route lấy thông tin sản phẩm trong kho
    app.get('/inventory_dashboard_edit/:id', async(req, res)=>{
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            const roles_user = await pool.query(`select * from users where id = $1`, [req.session.user_id])
            //Nếu là admin sẽ được phép truy cập link, ngược lại trả về trang chủ
            if(roles_user.rows[0]['roles'] == 1){
                res.redirect('/')
            }else{
                const qty_food = await pool.query(`select inventory.id, inventory.food_id, inventory.quantity, foods.name
                from inventory, foods
                where inventory.food_id = foods.id and inventory.id = $1`, [req.params.id])
                console.log('qty food = ', qty_food.rows)
                res.render('inventory_dashboard_edit', {
                    menu: 'inventory_dashboard',
                    data: qty_food.rows,
                    name: req.session.name, 
                    roles: req.session.roles,
                    email: req.session.email
                })
            }
        }
    })
    
    //route chỉnh sửa sản phẩm trong kho
    app.get('/inventory_dashboard', async(req, res)=>{
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            const roles_user = await pool.query(`select * from users where id = $1`, [req.session.user_id])
            //Nếu là admin sẽ được phép truy cập link, ngược lại trả về trang chủ
            if(roles_user.rows[0]['roles'] == 1){
                res.redirect('/')
            }else{
                const info_inventory = await pool.query(`select inventory.id,inventory.food_id, inventory.quantity, foods.name
                from inventory, foods
                where inventory.food_id = foods.id
                order by inventory.id `)
                
                console.log('qty_food = ', info_inventory.rows)
                res.render('inventory_dashboard', {
                    menu: 'inventory_dashboard',
                    data: info_inventory.rows,
                    name: req.session.name, 
                    roles: req.session.roles,
                    email: req.session.email
                })
            }
        }
    })

    //route nhận thông tin chỉnh sửa thông tin sản phẩm trong kho
    app.post('/inventory_dashboard_edit/:id', urlencodedParser, async(req, res)=>{
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            //lấy thông tin user
            const roles_user = await pool.query(`select * from users where id = $1`, [req.session.user_id])
            //Nếu là admin sẽ được phép truy cập link, ngược lại trả về trang chủ
            if(roles_user.rows[0]['roles'] == 1){
                res.redirect('/')
            }else{
                const update_qty_food = await pool.query(`update inventory
                set quantity = $1
                where id = $2`, [req.body.quantity, req.params.id])
                res.redirect('/inventory_dashboard')
            }
        }
    })

    //route trang chủ admin
    app.get('/product_dashboard', async (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            const roles_user = await pool.query(`select * from users where id = $1`, [req.session.user_id])
            //Nếu là admin sẽ được phép truy cập link, ngược lại trả về trang chủ
            if(roles_user.rows[0]['roles'] == 1){
                res.redirect('/')
            }else{
                
                //Lấy danh sách sản phẩm
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
                            menu: 'product_dashboard',
                            data: result.rows,
                            name: req.session.name, 
                            roles: req.session.roles,
                            email: req.session.email
                        });
                    });
                });
            }
        }
    })  

    //route chỉnh sửa danh mục trong admin
    app.get('/edit_category/:id', urlencodedParser, async(req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            
            const roles_user = await pool.query(`select * from users where id = $1`, [req.session.user_id])
            //Nếu là admin sẽ được phép truy cập link, ngược lại trả về trang chủ
            if(roles_user.rows[0]['roles'] == 1){
                res.redirect('/')
            }else{
                
                //Lấy category theo id
                const category = await pool.query(`select * from category where id = $1`, [req.params.id])
                res.render('category_dashboard_edit', {
                    category: category.rows,
                    name: req.session.name,
                    roles: req.session.roles,
                    email: req.session.email
                })
            }
        }
    })
    
    //route chỉnh sửa danh mục trong admin
    app.post('/edit_category/:id', urlencodedParser, async(req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            
            const roles_user = await pool.query(`select * from users where id = $1`, [req.session.user_id])
            //Nếu là admin sẽ được phép truy cập link, ngược lại trả về trang chủ
            if(roles_user.rows[0]['roles'] == 1){
                res.redirect('/')
            }else{
                    
                //Chỉnh sửa danh mục theo id
                const category = await pool.query(`update category
                set name = $1 , description=$2
                where id = $3;`, [req.body.name, req.body.description, req.params.id])
                console.log('cập nhật thành công')
                res.redirect('/category_dashboard')
            }
        }
    })
    
    //chỉnh sửa thông tin ng dùng
    app.get('/edit_users/:id', urlencodedParser, async(req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            const roles_user = await pool.query(`select * from users where id = $1`, [req.session.user_id])
            //Nếu là admin sẽ được phép truy cập link, ngược lại trả về trang chủ
            if(roles_user.rows[0]['roles'] == 1){
                res.redirect('/')
            }else{
                
                //Lấy thông tin người dùng theo id
                const user = await pool.query(`select * from users where id = $1`, [req.params.id])
                res.render('customer_dashboard_edit', {
                    menu: 'edit_users',
                    user: user.rows,
                    name: req.session.name,
                    roles: req.session.roles,
                    email: req.session.email
                })
            }
        }
    })
    
    //route chỉnh sửa người dùng
    app.post('/edit_users/:id', urlencodedParser, async(req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            if(req.session.roles != 0){
                res.redirect('/')
            }else{
                //Cập nhật người dùng theo id
                const edit_users = await pool.query(`update users
                set name = $1 , phone=$2
                where id = $3;`, [req.body.name, req.body.phone, req.params.id])
                console.log('cập nhật thành công')
                res.redirect('/customer_dashboard')
            }
        }
    })

    
    //route xem các order của admin
    app.get('/order_dashboard', urlencodedParser, async(req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            const roles_user = await pool.query(`select * from users where id = $1`, [req.session.user_id])
            //Nếu là admin sẽ được phép truy cập link, ngược lại trả về trang chủ
            if(roles_user.rows[0]['roles'] == 1){
                res.redirect('/')
            }else{
                
                //Lấy danh sách đơn hàng
                const orders = await pool.query(`select orders.id, orders.owner_id, orders.delivery_time, orders.delivery_fee, orders.discount, orders.amount, orders.states, addresses.street, addresses.wardid, addresses.districtid, addresses.provinceid
                from orders, addresses
                where orders.address_id = addresses.id`)
                console.log('orders = ', orders.rows)
                res.render('orders_dashboard', {
                    menu: 'order_dashboard',
                    orders: orders.rows,
                    name: req.session.name,
                    roles: req.session.roles,
                    email: req.session.email
                })
            }
        }
    })
    //route lấy form chỉnh sửa order của admin
    app.get('/edit_order_dashboard/:id', urlencodedParser,async (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            const roles_user = await pool.query(`select * from users where id = $1`, [req.session.user_id])
            //Nếu là admin sẽ được phép truy cập link, ngược lại trả về trang chủ
            if(roles_user.rows[0]['roles'] == 1){
                res.redirect('/')
            }else{
                
                //Lấy đơn hàng theo id
                const order = await pool.query(`select orders.id, orders.address_id, orders.owner_id, orders.delivery_time, orders.delivery_fee, orders.discount, orders.amount, orders.states, addresses.street, addresses.wardid, addresses.districtid, addresses.provinceid
                from orders, addresses
                where orders.address_id = addresses.id and orders.id = $1`, [req.params.id])
                //Lấy các sản phẩm trong đơn hàng
                const order_items = await pool.query(`select *
                from order_items
                where order_id = $1`, [req.params.id])
                //Lấy khách hàng của đơn hàng
                const owner_order = await pool.query(`select * from users where id = $1`, [order.rows[0]['owner_id']])
                //Lấy địa chỉ của khách hàng
                const address = await pool.query(`select * from addresses where id = $1`, [order.rows[0]['address_id']])
                //Lấy danh sách sản phẩm
                const foods = await pool.query(`select * from foods`)
                res.render('orders_dashboard_edit', {
                    menu: 'edit_order_dashboard',
                    name: req.session.name, 
                    email: req.session.email,
                    user_id: req.session.user_id,
                    order: order.rows,
                    order_items: order_items.rows,
                    owner_order: owner_order.rows,
                    roles: req.session.roles,
                    address: address.rows,
                    foods: foods.rows
                })
            }
        }
    })

    //route lấy form địa chỉ của admin
    app.get('/addresses_dashboard', urlencodedParser, async(req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            if(req.session.roles != 0){
                res.redirect('/')
            }else{
                //lấy danh sách địa chỉ
                const addresses = await pool.query(`select *
                from addresses`)
                console.log('address = ', addresses.rows)
                res.render('address_dashboard', {
                    addresses: addresses.rows,
                    name: req.session.name,
                    roles: req.session.roles,
                    menu: 'addresses_dashboard',
                    email: req.session.email
                })
            }
            
        }
    })
      
    //route lấy form thêm địa chỉ của admin
    app.get('/address_dashboard_add', async (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            const roles_user = await pool.query(`select * from users where id = $1`, [req.session.user_id])
            //Nếu là admin sẽ được phép truy cập link, ngược lại trả về trang chủ
            if(roles_user.rows[0]['roles'] == 1){
                res.redirect('/')
            }else{
                
                //Lấy danh sách user là khách hàng (roles = 1)
                const users = await pool.query(`select * from users where roles = 1`)
                let errors = []
                res.render("address_dashboard_add", {
                    menu: 'address_dashboard_add',
                    users: users.rows,
                    name: req.session.name,
                    email: req.session.email,
                    roles: req.session.roles,
                    errors: errors
                });
            }
        }
    }) 
      
    //route kiểm tra, thêm địa chỉ của admin
    app.post('/address_dashboard_add', urlencodedParser, async (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            
            if(req.session.roles != 0){
                res.redirect('/')
            }else{
                const users = await pool.query(`select * from users where roles = 1`)
                var regex = /^((09|03|07|08|05)+([0-9]{8})\b)$/
                let errors = []
                
                //Kiểm tra tính hợp lệ của số điện thoại
                //Nếu sai thì báo lỗi và ngược lại
                if(regex.test(req.body.phone) != true){
                    errors.push({message: "Phone invalid!"})
                    res.render("address_dashboard_add", {
                        users: users.rows,
                        name: req.session.name,
                        email: req.session.email,
                        roles: req.session.roles,
                        errors: errors
                    });
                }else{
                    /*
                    Nếu là địa chỉ mặc định thì kiểm tra danh sách địa chỉ trước đó
                    Nếu đã có địa chỉ mặc định thì set địa chỉ vừa tìm đc bằng false rồi set địa chỉ mới là true
                    */
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
        }
    }) 

    //route lấy form chỉnh sửa địa chỉ của admin
    app.get('/edit_address_dashboard/:id', urlencodedParser,async (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            
            if(req.session.roles != 0){
                res.redirect('/')
            }else{
                const roles_user = await pool.query(`select * from users where id = $1`, [req.session.user_id])
                //Nếu là admin sẽ được phép truy cập link, ngược lại trả về trang chủ
                if(roles_user.rows[0]['roles'] == 1){
                    res.redirect('/')
                }else{
                    
                    //Lấy danh sách các địa chỉ
                    const address = await pool.query(`select * FROM addresses WHERE id = $1`, [req.params.id])

                    res.render('address_dashboard_edit', {
                        menu: 'edit_address_dashboard',
                        name: req.session.name, 
                        email: req.session.email,
                        user_id: req.session.user_id,
                        roles: req.session.roles,
                        address: address.rows
                    })
                }
            }
        }
    })

    //route kiểm tra, chỉnh sửa địa chỉ của admin
    app.post('/edit_address_dashboard/:id', urlencodedParser, async (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            
            if(req.session.roles != 0){
                res.redirect('/')
            }else{
                const address = await pool.query(`select * FROM addresses WHERE id = $1`, [req.params.id])
                var regex = /^((09|03|07|08|05)+([0-9]{8})\b)$/
                let errors = []
                //Kiểm tra tính hợp lệ của số điện thoại
                //Nếu sai thì báo lỗi và ngược lại
                if(regex.test(req.body.phone) != true){
                    errors.push({message: "Phone invalid!"})
                    
                    res.render("edit_dia_chi", {
                        name: req.session.name,
                        address: address.rows,
                        roles: req.session.roles,
                        email: req.session.email,
                        errors: errors
                    });
                }else{
                    
                    const all_address_tmp = await pool.query(`select * from addresses where id = $1`,[req.params.id]);
                    // console.log('all_address_tmp = ', all_address_tmp.rows)
                    const all_address = await pool.query(`select * from addresses where user_id = $1`, [all_address_tmp.rows[0]['user_id']])
                    /*
                    Nếu là địa chỉ mặc định thì kiểm tra danh sách địa chỉ trước đó
                    Nếu đã có địa chỉ mặc định thì set địa chỉ vừa tìm đc bằng false rồi set địa chỉ mới là true
                    */
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
        }
    })

    //route xóa địa chỉ của admin
    app.get('/del_address_dashboard/:id', urlencodedParser, async (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            
            if(req.session.roles != 0){
                res.redirect('/')
            }else{
                const del_wishlist = await pool.query(`DELETE FROM addresses WHERE id = $1`,[req.params.id]);
                res.redirect("/addresses_dashboard")
            }
        }
    })

    //route kiểm tra, thêm danh mục của admin
    app.post('/category_add', urlencodedParser, upload.single('image'),async (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            const roles_user = await pool.query(`select * from users where id = $1`, [req.session.user_id])
            //Nếu là admin sẽ được phép truy cập link, ngược lại trả về trang chủ
            if(roles_user.rows[0]['roles'] == 1){
                res.redirect('/')
            }else{
                
                //Thêm category vào db
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
        }
    })
    
    //route lấy form thêm sản phẩm của admin
    app.get('/product_add', async (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            
            const roles_user = await pool.query(`select * from users where id = $1`, [req.session.user_id])
            //Nếu là admin sẽ được phép truy cập link, ngược lại trả về trang chủ
            if(roles_user.rows[0]['roles'] == 1){
                res.redirect('/')
            }else{
                let errors = []
                pool.connect(function(err,client, done){
                    if(err){
                        throw err;
                    }
                    //Lấy danh sách category
                    pool.query(`SELECT * FROM category`,(err, result)=>{
                        if(err){
                            throw err;
                        }
                        res.render("product_add", {
                            data: result.rows, 
                            menu: 'product_dashboard',
                            name: req.session.name, 
                            email: req.session.email,
                            roles: req.session.roles,
                            errors: [{
                                code: 200,
                                message: "None"
                            }]
                        });
                    })
                })
            }
        }
    })  
    //route thêm sản phẩm của admin
    app.post('/product_add', urlencodedParser, upload.single('image'),async (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            
            if(req.session.roles != 0){
                res.redirect('/')
            }else{
                //Kiểm tra sản phẩm đã tồn tại chưa
                const foods = await pool.query(`select * from foods`)
                var food_exist = 0
                let errors = []
                for(var i=0; i<foods.rows.length; i++){
                    if(foods.rows[i]['name'].toLowerCase() == req.body.name.toLowerCase()){
                        food_exist = 1
                    }
                }
                if(food_exist != 0){
                    errors.push({
                        code: 400,
                        message: "Product already exists!"
                    })
                    const category = await pool.query(`select * from category order by id`)
                    res.render("product_add", {
                        data: category.rows, 
                        name: req.session.name, 
                        email: req.session.email,
                        roles: req.session.roles,
                        menu: 'product_dashboard',
                        errors: errors
                    });

                }else{

                    //lưu đường dẫn lưu ảnh
                    const imagePath = path.join(__dirname, '../public/images/');
                    //giảm kích thước ảnh
                    const fileUpload = new Resize(imagePath);
                    if (!req.file) {
                        // res.status(401).json({error: 'Please provide an image'});
                        //Nếu người dùng không up file ảnh thì mặc định là ảnh trắng
                        const insert_food = await pool.query(`INSERT INTO foods (name, description, category_id, price, images)
                        VALUES ($1,$2,$3,$4,$5);`, [req.body.name, req.body.description, req.body.category, req.body.price, ''])
                        const search_food = await pool.query(`select * from foods where name = $1`, [req.body.name])
                        const add_inventory = await pool.query(`insert into inventory (food_id, quantity)
                        values ($1, $2);`, [search_food.rows[0]['id'], 0])
                        console.log('Thêm thành công')
                        res.redirect('/product_dashboard');
                        
                        // pool.query(`INSERT INTO foods (name, description, category_id, price, images)
                        // VALUES ($1,$2,$3,$4,$5);`,
                        // [req.body.name, req.body.description, req.body.category, req.body.price, ''], (err, result)=>{
                        //     if(err){
                        //         throw err;
                        //     }
                        //     console.log('Thêm thành công')
                        //     res.redirect('/product_dashboard');
                        // });
                    }else{
                        //Lưu file vào đường dẫn trên 
                        const filename = await fileUpload.save(req.file.buffer);
                        //Thêm sản phẩm vào database
                        const insert_food = await pool.query(`INSERT INTO foods (name, description, category_id, price, images)
                        VALUES ($1,$2,$3,$4,$5);`, [req.body.name, req.body.description, req.body.category, req.body.price, 'images/'+filename])
                        const search_food = await pool.query(`select * from foods where name = $1`, [req.body.name])
                        const add_inventory = await pool.query(`insert into inventory (food_id, quantity)
                        values ($1, $2);`, [search_food.rows[0]['id'], 0])
                        console.log('Thêm thành công')
                        res.redirect('/product_dashboard');

                        // pool.query(`INSERT INTO foods (name, description, category_id, price, images)
                        // VALUES ($1,$2,$3,$4,$5);`,
                        // [req.body.name, req.body.description, req.body.category, req.body.price, 'images/'+filename], (err, result)=>{
                        //     if(err){
                        //         throw err;
                        //     }
                        //     console.log('Thêm thành công')
                        //     res.redirect('/product_dashboard');
                        // });
                    }
                }
            }

        }
    })
    //route danh mục sản phẩm của admin
    app.get('/category_dashboard', async (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            
            if(req.session.roles != 0){
                res.redirect('/')
            }else{
                const roles_user = await pool.query(`select * from users where id = $1`, [req.session.user_id])
                //Nếu là admin sẽ được phép truy cập link, ngược lại trả về trang chủ
                if(roles_user.rows[0]['roles'] == 1){
                    res.redirect('/')
                }else{
                    
                    //lấy danh sách cách category của sản phẩm
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
                                menu: 'category_dashboard',
                                data: result.rows,
                                roles: req.session.roles,
                                name: req.session.name, 
                                email: req.session.email
                            });
                        });
                    });
                }
            }
        }
    })  
    //route thêm danh mục sản phẩm của admin
    app.get('/category_dashboard_add', async (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            
            const roles_user = await pool.query(`select * from users where id = $1`, [req.session.user_id])
            //Nếu là admin sẽ được phép truy cập link, ngược lại trả về trang chủ
            if(roles_user.rows[0]['roles'] == 1){
                res.redirect('/')
            }else{
                
                res.render("category_dashboard_add", {name: req.session.name});
            }
        }
    })  
    //route thông tin người dùng của admin
    app.get('/customer_dashboard', urlencodedParser, async (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            const roles_user = await pool.query(`select * from users where id = $1`, [req.session.user_id])
            //Nếu là admin sẽ được phép truy cập link, ngược lại trả về trang chủ
            if(roles_user.rows[0]['roles'] == 1){
                res.redirect('/')
            }else{
                
                //lấy danh sách user có roles là khách hàng (roles = 1)
                const users = await pool.query(`select * from users where roles = 1`);
                res.render("customer_dashboard", {
                    menu:'customer_dashboard',
                    users: users.rows,
                    email: req.session.email,
                    roles: req.session.roles,
                    name: req.session.name
                });
            }    
        }
    })  
    app.get('/customer_dashboard_add', (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            
            if(req.session.roles != 0){
                res.redirect('/')
            }else{
                res.render("customer_dashboard_add", {name: req.session.name});
            }
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
            //Nếu đơn hàng chưa có sản phẩm thì SL hiển thị là 0 và ngược lại
            if (search_order.rows == '') {
            
                res.render('information_user', {
                    data: information_user.rows, 
                    name: req.session.name, 
                    roles: req.session.roles,
                    user_id: req.session.user_id,
                    quantity_foods: [{"count": 0}]
                })
            }else{
                //đếm sản phẩm trong giỏ hàng
                const quantity_foods = await pool.query(`SELECT COUNT (food_id)
                FROM order_items
                where order_id = $1
                GROUP BY order_id = $2`, [search_order.rows[0]['id'], search_order.rows[0]['id']])
    
                res.render('information_user', {
                    data: information_user.rows, 
                    name: req.session.name, 
                    roles: req.session.roles,
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
            //Nếu đơn hàng chưa có sản phẩm thì SL hiển thị là 0 và ngược lại
            if (search_order.rows == ''){
                res.render("quen_mat_khau", {
                    name: req.session.name,
                    errors: errors,
                    quantity_foods: [{"count": 0}]
                });
            }else{
                //đếm số lượng sản phẩm trong đơn hàng
                const quantity_foods = await pool.query(`SELECT COUNT (food_id)
                FROM order_items
                where order_id = $1
                GROUP BY order_id = $2`, [search_order.rows[0]['id'], search_order.rows[0]['id']])
        
                res.render("quen_mat_khau", {
                    name: req.session.name,
                    errors: errors,
                    roles: req.session.roles,
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
                //Nếu đơn hàng chưa có sản phẩm thì SL hiển thị là 0 và ngược lại
                if (search_order.rows == ''){
                    
                    res.render("quen_mat_khau", {
                        name: req.session.name,
                        errors: errors,
                        roles: req.session.roles,
                        quantity_foods: [{"count": 0}]
                    });
                }else{
                    //Đếm số lượng sản phẩm
                    const quantity_foods = await pool.query(`SELECT COUNT (food_id)
                    FROM order_items
                    where order_id = $1
                    GROUP BY order_id = $2`, [search_order.rows[0]['id'], search_order.rows[0]['id']])
            
                    res.render("quen_mat_khau", {
                        name: req.session.name,
                        errors: errors,
                        roles: req.session.roles,
                        quantity_foods: quantity_foods.rows
                    });
                }
            }else if (!bcrypt.compareSync(req.body.old_password, users.rows[0]['password'])){
                //Giải mã mật khẩu lưu trong db
                //Nếu không khớp sẽ báo lỗi và ngược lại
                errors.push({new_confirm: "Password don't match!"})
                //Nếu đơn hàng chưa có sản phẩm thì SL hiển thị là 0 và ngược lại
                if (search_order.rows == ''){
                    res.render("quen_mat_khau", {
                        name: req.session.name,
                        errors: errors,
                        roles: req.session.roles,
                        quantity_foods: [{"count": 0}]
                    });
                }else{
                    //Đếm số lượng sản phẩm trong đơn hàng
                    const quantity_foods = await pool.query(`SELECT COUNT (food_id)
                    FROM order_items
                    where order_id = $1
                    GROUP BY order_id = $2`, [search_order.rows[0]['id'], search_order.rows[0]['id']])
            
                    res.render("quen_mat_khau", {
                        name: req.session.name,
                        errors: errors,
                        roles: req.session.roles,
                        quantity_foods: quantity_foods.rows
                    });
                }
            }else{
                //mã hóa mật khẩu mới để lưu vào db
                let hashed_password = await bcrypt.hash(req.body.new_password, 10);
                //tìm user theo id để lưu mật khẩu mã hóa mới
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
            //Lấy thông tin đơn hàng của user
            const search_order = await pool.query(`select * 
            from orders
            where owner_id = $1 and states = 'draft'`, [req.session.user_id])
            const list_address = await pool.query(`select * from addresses where user_id = $1`, [req.session.user_id])
            //Nếu đơn hàng chưa có sản phẩm thì SL hiển thị là 0 và ngược lại
            if (search_order.rows == ''){
                
                res.render("show_dia_chi", {
                    name: req.session.name,
                    quantity_foods: [{'count': 0}],
                    roles: req.session.roles,
                    list_address: list_address.rows
                });
            }else{
                //đếm số lượng sản phẩm
                const quantity_foods = await pool.query(`SELECT COUNT (food_id)
                FROM order_items
                where order_id = $1
                GROUP BY order_id = $2`, [search_order.rows[0]['id'], search_order.rows[0]['id']])
        
                res.render("show_dia_chi", {
                    name: req.session.name,
                    quantity_foods: quantity_foods.rows,
                    roles: req.session.roles,
                    list_address: list_address.rows
                });
            }
        }else{
            res.redirect("/login");
        }
        
    }) 
}

module.exports = route