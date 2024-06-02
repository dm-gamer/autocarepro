const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const bcrypt = require('bcrypt');
const Task = require('./public/models/task');
const User = require('./public/models/user');

const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Database connection
try {
    // Connect to the MongoDB cluster
    mongoose.connect(
        "mongodb+srv://pugalarasan:pugalarasan@cluster1.gtxc1qt.mongodb.net/todos",
        { useNewUrlParser: true, useUnifiedTopology: true },
        () => console.log("Mongoose is connected")
    );
} catch (e) {
    console.log(e);
    console.log("Could not connect to MongoDB");
}


// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
}));

// Set up the view engine
app.set('view engine', 'ejs');
app.set('views', './public/views');

// Middleware to check authentication
function checkAuth(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
}

// Middleware to check admin role
function checkAdmin(req, res, next) {
    if (req.session.userRole === 'Admin') {
        next();
    } else {
        res.redirect('/');
    }
}

// Route for the home page
app.get('/', checkAuth, async (req, res) => {
    try {
        // Check if the user is an admin
        if (req.session.userRole === 'Admin') {
            // Redirect admin to admin page
            res.redirect('/admin');
        } else {
            // If not admin, load user's tasks
            const tasks = await Task.find({ user: req.session.userId });
            res.render('home', {
                tasks: tasks,
                user: req.session.user
            });
        }
    } catch (error) {
        res.send("Error loading tasks");
    }
});


app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', async (req, res) => {
    try {
        const user = await User.findOne({ name: req.body.username });

        if (!user) {
            res.send("Username not found");
        } else {
            const isPasswordMatch = await bcrypt.compare(req.body.password, user.password);
            if (!isPasswordMatch) {
                res.send("Wrong Password");
            } else {
                req.session.user = user.name;
                req.session.userId = user._id;
                req.session.userRole = user.role;
                if (user.role === 'Admin') {
                    res.redirect('/admin');
                } else {
                    res.redirect('/');
                }
            }
        }
    } catch (error) {
        res.send("Error occurred during login");
    }
});

app.get('/signup', (req, res) => {
    res.render('signup');
});

app.get('/profile', checkAuth, async (req, res) => {
    const user = await User.findById(req.session.userId);
    res.render('profile', { user });
});

app.get('/admin', checkAdmin, async (req, res) => {
    try {
        const tasks = await Task.find({}).populate('user');
        const users = await User.find({});
        res.render('admin', { tasks, users });
    } catch (error) {
        console.log(error)
        res.send("Error loading admin page");
    }
});

app.get('/admin-login', (req, res) => {
    res.render('admin-login');
});

app.post('/admin-login', async (req, res) => {
    try {
        const user = await User.findOne({ name: req.body.username });

        if (!user) {
            res.send("Admin Username not found");
        } else {
            const isPasswordMatch = await bcrypt.compare(req.body.password, user.password);
            if (!isPasswordMatch || user.role !== 'Admin') {
                res.send("Wrong Admin Password or not an admin");
            } else {
                req.session.user = user.name;
                req.session.userId = user._id;
                req.session.userRole = user.role;
                res.redirect('/admin');
            }
        }
    } catch (error) {
        res.send("Error occurred during admin login");
    }
});

app.get('/landing', (req, res) => {
    res.render('landing');
});

app.post('/signup', async (req, res) => {
    const data = {
        name: req.body.username,
        password: req.body.password,
        role: req.body.role || 'User'  // Default role is 'User'
    };

    const existingUser = await User.findOne({ name: data.name });

    if (existingUser) {
        res.send('User already exists. Please choose a different username.');
    } else {
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(data.password, saltRounds);

        data.password = hashedPassword;

        await User.create(data);
        res.redirect('/login');
    }
});

app.post('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

app.post('/create-task', checkAuth, async (req, res) => {
    await Task.create({
        description: req.body.description,
        category: req.body.category,
        date: req.body.date,
        user: req.session.userId
    });

    res.redirect('/');
});

app.post('/delete-task', checkAuth, async (req, res) => {
    const ids = Object.keys(req.body);
    for (let id of ids) {
        await Task.findByIdAndDelete(id);
    }
    res.redirect('/');
});

app.post('/update-profile', checkAuth, async (req, res) => {
    const user = await User.findById(req.session.userId);
    user.name = req.body.username;
    user.password = await bcrypt.hash(req.body.password, 10);
    await user.save();
    res.redirect('/');
});

app.post('/update-task-status', checkAdmin, async (req, res) => {
    const task = await Task.findById(req.body.taskId);
    task.status = req.body.status;
    await task.save();
    res.redirect('/admin');
});

// Listen on the port
app.listen(port, (err) => {
    if (err) {
        console.log(`Error in running the server: ${err}`);
    }
    console.log(`Server is running on port: ${port}`);
});


module.exports = app;