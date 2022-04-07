const path = require('path');
const express = require('express');
const morgan = require('morgan');
const session = require('express-session');
const flash = require('express-flash');
const bodyParser = require('body-parser');
const pool = require('./routes/db');
const passport = require("passport");
const bcrypt = require("bcrypt");


/* const { engine } = require('express-handlebars');*/
// const {Pool} = require('pg');

const route = require('./routes');
// const env = require('dotenv');
// const { render } = require('express/lib/response')
const app = express()
const port = process.env.PORT

const initiablizePassport = require("./routes/passportConfig");
// const initiablizePassport = require("/src/routes/passportConfig");
initiablizePassport(passport);

// app.use(session({
//   secret: 'secrect',
//   resave: false,
//   saveUninitialized: false
// }));

app.use(session({
  secret: 'secrect',
  resave: true,
  saveUninitialized: true,
  cookie: { maxAge: 60000000 }
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(flash());

// create application/x-www-form-urlencoded parser
var urlencodedParser = bodyParser.urlencoded({ extended: false })
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

// app.get('/login', (req, res) => {
//   res.render('login1')
// }) 
// app.post('/login', passport.authenticate('local', {
//   successRedirect: '/',
//   failureRedirect: '/login',
//   failureFlash: true
// }));

app.get('/login', (req, res) => {
  res.render('login1')
}) 
app.post('/login',urlencodedParser, async function(req, res) {
  let email = req.body.email;
  let password = req.body.password;
  console.log('email = ', email)
  pool.query(`SELECT * FROM users WHERE email = $1`, [email] , (err, rows) => {
      console.log('rows = ', rows);
      if (rows.length<=0) { res.redirect("/login"); return;}
      let user = rows['rows'][0];    
      console.log('user = ', user);
      
      let errors = []
      if(typeof user != 'undefined'){
        let pass_fromdb = user.password;          
        var kq = bcrypt.compareSync(password, pass_fromdb);
        if (kq){ 
            console.log("OK");   
            var sess = req.session;  //initialize session variable
            sess.user = true;
            sess.id = user.id;
            sess.name = user.name;
            sess.email = user.email;  
            sess.roles = user.roles;
            console.log('sess = ', sess)

            // if (sess.back){ 
            //   console.log(sess.back);
            //   res.redirect(sess.back);
            // }
            // else {
            //     res.redirect("/");
            // }
            if (user.roles == 1){
              res.redirect("/");   
            }else{
              res.redirect('/product_dashboard');
            }           
        }   
        else {
          errors.push({message: "Email/Password is not correct!"})
          console.log("Not OK");
          res.render("login1", {errors});
        }
      }else{
      
        errors.push({message: "Email/Password is not correct!"})
        console.log("Không có tài khoản trong hệ thống");
        console.log("errors = ", errors);
        res.render("login1", {errors});

      }
      
  });   
});
app.get('/logout', function(req, res) {
  req.session.destroy();
  res.redirect("/login");
});

app.listen(port || 5001, () => {
  console.log('Server running...')
})

route(app);
