class BlogControllers{

    index(req, res){
        res.render('blog')
    }
}


module.exports = new BlogControllers;