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
        
        const data = {}
        var product_list
        var category_list
        // res.render('shop11', {hoten: "ngô Quang trường"})

        pool.connect(function(err, client, done){
            if(err){
                return console.error('error fetching client from pool ', err)
            }
            // console.log('connected')
            // return res.send('connected')
            client.query('SELECT * FROM foods', (err, result) => {
                done()
            
                if(err){
                    res.end()
                    return console.error('error running query ', err)
                }
                product_list = result
                data['product'] = result.rows
                data['category'] = result.rows
                console.log('product = ', product_list)
                console.log('data = ', data)
                res.render('shop11', {data: result.rows, name:req.session.name})
            });
        });

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
        // console.log('product list ở ngoài =', product_list)
        // console.log('category list ở ngoài =', category_list)
        // console.log('data ngoài = ', data)
        // res.render('shop1', product_list, category_list)
        // res.render('shop1')
    }
}


module.exports = new ShopControllers;