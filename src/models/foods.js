// const db = require('../routes/db');
const {Pool} = require('pg')
const {migrate} = require('postgres-migrations')
const env = require('dotenv');

env.config({
    path:'./.env'
})
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
})

pool.connect();

module.exports = class Foods {
  constructor(category_id, name, description, price, images) {
    this.category_id = this.category_id;
    this.name = name;
    this.description = description;
    this.price = price;
    this.images = this.images;
  }


  static get_all_foods() {
    console.log('all_foods = ', db.query(`select * from foods`))
    // return db.query('SELECT * FROM foods');
    return db.query('SELECT * FROM foods', (err, res)=>{
      if(err){
        throw err;
      }

      console.log('vals = ', res.rows)
      return res.rows
    })
  }


  static fetch_all() {
    return db.query('SELECT * FROM foods');
  }

  // static save(foods) {
  //   return db.query(
  //     'INSERT INTO posts (category_id, name, body, price, images) VALUES (?, ?, ?, ?, ?)',
  //     [foods.category_id, foods.body, foods.c]
  //   );
  // }

  // static delete(id) {
  //   return db.execute('DELETE FROM posts WHERE id = ?', [id]);
  // }

  // static getByID(id) {
  //   return db.execute('SELECT * FROM posts WHERE id = ?', [id]);
  // }
};
