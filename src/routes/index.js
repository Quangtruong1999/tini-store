const shop_routes = require('./shop')
const blogs_router = require('./blogs')
const {Pool} = require('pg')
const {migrate} = require('postgres-migrations')
const env = require('dotenv');

env.config({
    path:'./.env'
})
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
})
async function route(app){
    app.get('/db', (req, res) => {
        pool.connect(function(err, client, done){
            if(err){
                return console.error('error fetching client from pool ', err)
            }
            console.log('connected')
            return res.send('connected')
            // client.query('SELECT * FROM position', (err, result) => {
            //     done();
            
            //     if(err){
            //         res.end();
            //         return console.error('error running query ', err)
            //     }
            //     console.log('Data = ', result.rows)
            //     res.render('db', {data: result.rows})
            // });
        });
    })
    
    app.get('/', (req, res) => {
        res.render('index')
    })  
              
    app.get('/shop11', shop_routes)  
    // app.get('/shop11', shop_routes)   
    
    app.get('/login', (req, res) => {
        res.render('login1')
    })       
    app.get('/signup', (req, res) => {
        res.render('signup')
    })      
    app.get('/forgot', (req, res) => {
        res.render('forgot_password')
    }) 
    app.get('/about', (req, res) => {
        res.render('about')
    })          
    app.get('/blog', (req, res) => {
        res.render('blog')
    })          
    app.get('/cart', (req, res) => {
        res.render('cart')
    })          
    app.get('/blog-single', (req, res) => {
        res.render('blog-single')
    })          
    app.get('/checkout', (req, res) => {
        res.render('checkout')
    })          
    app.get('/contact', (req, res) => {
        res.render('contact')
    })          
    app.get('/product-single', (req, res) => {
        res.render('product-single')
    })          
    app.get('/shop', shop_routes)          
    app.get('/wishlist', (req, res) => {
        res.render('wishlist')
    }) 
}

module.exports = route