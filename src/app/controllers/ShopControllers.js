const {Pool} = require('pg')
const env = require('dotenv');
const session = require('express-session');
env.config({
    path:'./.env'
})
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
})


class ShopControllers{

    index(req, res){
        
        const foods = pool.query(`SELECT * FROM foods`);
        const category =  pool.query(`SELECT * FROM foods`);
        console.log('foods = ', foods.rows)
        console.log('category = ', category.rows)
        // res.render('db', {foods: foods.rows, category: category.rows})
        res.render('shop11', {foods: foods.rows, category: category.rows, name:req.session.name})

        // pool.connect(function(err, client, done){
        //     if(err){
        //         return console.error('error fetching client from pool ', err)
        //     }
        //     // console.log('connected')
        //     // return res.send('connected')
        //     client.query('SELECT * FROM foods', (err, result) => {
        //         done()
            
        //         if(err){
        //             res.end()
        //             return console.error('error running query ', err)
        //         }
        //         product_list = result
        //         data['product'] = result.rows
        //         data['category'] = result.rows
        //         console.log('product = ', product_list)
        //         console.log('data = ', data)
        //         res.render('shop11', {data: result.rows, name:req.session.name})
        //     });
        // });

        // pool.connect(function(err, client, done){
        //     if(err){
        //         return console.error('error fetching client from pool ', err)
        //     }
            
        //     client.query('SELECT * FROM category', (err, result) => {
        //         done();
            
        //         if(err){
        //             res.end();
        //             return console.error('error running query ', err)
        //         }
        //         let category_list = result.rows
                
        //         console.log('Category 1 = ', category_list)
        //         res.end()
        //     });
        // });
        // console.log('product list ??? ngo??i =', product_list)
        // console.log('category list ??? ngo??i =', category_list)
        // console.log('data ngo??i = ', data)
        // res.render('shop1', product_list, category_list)
        // res.render('shop1')
    }
}


module.exports = new ShopControllers;