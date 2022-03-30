class UserControllers{

    index(req, res){
        res.render('blog')
    }
}


module.exports = new UserControllers;