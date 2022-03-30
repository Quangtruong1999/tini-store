const path = require('path');
const express = require('express');
const morgan = require('morgan');
const session = require('express-session');
/* const { engine } = require('express-handlebars');*/
// const {Pool} = require('pg');

const route = require('./routes');
// const env = require('dotenv');
// const { render } = require('express/lib/response')
const app = express()
const port = process.env.PORT

app.use(express.static(path.join(__dirname,'public')))
console.log('path = '+ __dirname)
//HTTP logger
app.use(morgan('combined'))
//Config ejs 
app.set("view engine", "ejs");
app.set('views', path.join(__dirname,'resources/views'));
//Templates engine
// app.engine('handlebars', engine());
// app.set('view engine', 'handlebars');
// console.log('path = ',path.join(__dirname,'resources/views') )
// app.set('views', path.join(__dirname,'resources/views'));



app.listen(port || 5001, () => {
  console.log('Server running...')
})

route(app);
