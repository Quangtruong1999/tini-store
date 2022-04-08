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
// initiablizePassport(passport);

// create application/x-www-form-urlencoded parser
var urlencodedParser = bodyParser.urlencoded({ extended: false })

// const {Pool} = require('pg')
// const {migrate} = require('postgres-migrations')
// const env = require('dotenv');

// env.config({
//     path:'./.env'
// })
// const pool = new Pool({
//     connectionString: process.env.DATABASE_URL,
// })

async function route(app){
    
    app.use(session({
        secret: 'secrect',
        resave: true,
        saveUninitialized: true,
        cookie: { maxAge: 60000000 }
    }));
    app.get('/db', async (req, res) => {
        console.log('Kết nối thành công')
        const foods = await pool.query(`SELECT * FROM foods`);
        const category = await pool.query(`SELECT * FROM foods`);
        console.log('foods = ', foods.rows)
        console.log('category = ', category.rows)
        res.render('db', {foods: foods.rows, category: category.rows})
        // pool.connect(function(err, client, done){
        //     if(err){
        //         return console.error('error fetching client from pool ', err)
        //     }
        //     console.log('connected')
        //     return res.send('connected')
        //     // client.query('SELECT * FROM position', (err, result) => {
        //     //     done();
            
        //     //     if(err){
        //     //         res.end();
        //     //         return console.error('error running query ', err)
        //     //     }
        //     //     console.log('Data = ', result.rows)
        //     //     res.render('db', {data: result.rows})
        //     // });
        // });
    })

    app.get('/', (req, res) => {
        console.log('name = ', req.session.name);
        console.log('check session = ', req.session);
        res.render("index", {name: req.session.name});
        // if (req.session.user) {
        //     res.render("index", {name: req.session.name});
        // }
        // else {     
        //     // res.redirect("/login");
        //     res.render("index", {name: req.session.name});
        // }
    })  
              
    app.get('/shop11', shop_routes)  
    // app.get('/shop11', shop_routes)   
    

    // app.get('/login', (req, res) => {
    //     res.render('login1')
    // })       
    app.get('/signup', (req, res) => {
        res.render('signup');
    })     
    app.post('/signup',urlencodedParser, async (req, res) => {
        let {name, phone, email, password, repassword} = req.body;
        console.log('name = ', name);
        console.log('phone = ', phone);
        console.log('email = ', email);
        console.log('password = ', password);
        console.log('repass = ',repassword);
        // Zack Steffen
        let errors = []
        let success = []
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
            let hashed_password = await bcrypt.hash(password, 10);
            
            pool.query(
                'SELECT * FROM users WHERE email = $1',[email], (err, result) => {
                    if (err){
                        throw err;
                    }

                    if(result.rows.length > 0){
                        errors.push({message: "Email already regiser!"})
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

                        // console.log('password = ', hashed_password)
                        // success.push({message: "Register successfull!"})
                        // res.render('signup', { success })
                    }
                    
                }
            )

        }
        
    })  
    
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
    
                        console.log('info = ', result.rows)
                        console.log('error = ', errors)
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
    app.get('/forgot', (req, res) => {
        res.render("forgot_password", {name: req.session.name});
    }) 
    app.get('/about', (req, res) => {
        res.render("about", {name: req.session.name});
    })          
    app.get('/blog', (req, res) => {
        res.render("blog", {name: req.session.name});
    })          
    app.get('/cart', (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            res.render("cart", {name: req.session.name});
        }
    })          
    app.get('/blog-single', (req, res) => {
        res.render("blog-single", {name: req.session.name});
    })          
    app.get('/checkout', (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            res.render("checkout", {name: req.session.name});
        }
    })          
    app.get('/contact', (req, res) => {
        res.render("contact", {name: req.session.name});
    })          
    app.get('/product-single/:id', (req, res) => {
        pool.connect(function(err, client, done){
            done();
            if(err){
                throw err;
            }

            pool.query(`select * from foods where id = $1`, [req.params.id], (err, result)=>{
                res.render("product-single", {data: result.rows, name: req.session.name});
            })
            
        });
    })          
    app.get('/shop/:id', async(req, res) =>{
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
        
    })          
    app.get('/wishlist', (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            res.render("wishlist", {name: req.session.name});
        }
    }) 

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

    app.get('/del_users/:id', urlencodedParser, (req, res) => {
        pool.connect(function(err,client, done){
            if(err){
                throw err;
            }
            pool.query(`DELETE FROM users WHERE id = $1`, [req.params.id], (err, result)=>{
                if(err){
                    throw err;
                }
                console.log('xóa thành công');
                res.redirect('/customer_dashboard');
            })
        })
    }) 

    app.get('/edit_pro/:id', urlencodedParser, (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            pool.connect(function(err,client, done){
                done()
                if(err){
                    throw err;
                }
                pool.query(`select * FROM foods WHERE id = $1`, [req.params.id], (err, result)=>{
                    if(err){
                        throw err;
                    }

                    console.log('lấy thành công = ', result.rows);
                    res.render('product_edit', {data: result.rows, name: req.session.name, email: req.session.email});
                })
            })
        }
        
        
    })

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
    app.get('/category_dashboard_add', (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            res.render("category_dashboard_add", {name: req.session.name});
        }
    })  
    app.get('/customer_dashboard', (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            pool.connect(function(err, client, done){
                if(err){
                    throw err;
                }

                pool.query(`select * from users`, (err, result)=>{

                    res.render("customer_dashboard", {data: result.rows, name: req.session.name});
                })
            })
        }
    })  
    app.get('/customer_dashboard_add', (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            res.render("customer_dashboard_add", {name: req.session.name});
        }
    }) 


    app.get('/information_user', (req, res) => {
        if(typeof req.session.user == 'undefined'){
            res.redirect('/login');
        }else{
            pool.connect(function(err, client, done){
                done()
                if(err){
                    throw err;
                }

                pool.query(`select * from users where email = $1`, [req.session.email], (err, result)=>{
                    if(err){
                        throw err;
                    }

                    console.log('info = ', result.rows)
                    res.render('information_user', {data: result.rows, name: req.session.name, user_id: req.session.user_id})
                })
            });
        }
    }) 

    app.get('/dia_chi', (req, res) => {
        res.render("dia_chi", {name: req.session.name});
    }) 
    app.get('/quen_mat_khau', (req, res) => {
        res.render("quen_mat_khau", {name: req.session.name});
    }) 
    app.get('/show_dia_chi', (req, res) => {
        res.render("show_dia_chi", {name: req.session.name});
    }) 
}

module.exports = route