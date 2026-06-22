if(process.env.NODE_ENV != "production"){
    require("dotenv").config();
}

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride =  require("method-override");
const ejsMate =  require("ejs-mate");
const ExpressError = require("./utils/ExpressError.js");
const session = require("express-session");
const MongoStore = require('connect-mongo');
const flash = require("connect-flash");
const passport =  require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");

const listingRouter = require("./routes/listing.js");
const reviewRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");

// Explicit direct string format that bypasses Node's broken SRV DNS lookup
const dbUrl = process.env.ATLASDB_URL || "mongodb://theishukaur_db_user:OReE6yaGYqZJ4dJQ@cluster0-shard-00-00.fquwuby.mongodb.net:27017,cluster0-shard-00-01.fquwuby.mongodb.net:27017,cluster0-shard-00-02.fquwuby.mongodb.net:27017/wanderlust?ssl=true&replicaSet=atlas-kvn9z8-shard-0&authSource=admin&retryWrites=true&w=majority";

async function main(){
    await mongoose.connect(dbUrl);
}

main().then(()=>{
    console.log("connected to DB");
    })
    .catch(err =>{
        console.log("Database connection error: ", err);
    });

app.set("view engine" , "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({extended: true}));
app.use(methodOverride("_method"));
app.engine("ejs",ejsMate);
app.use(express.static(path.join(__dirname,"/public")));

const store = (MongoStore.default ? MongoStore.default : MongoStore).create({
    mongoUrl: dbUrl,
    crypto: {
        secret: process.env.SECRET || "mysupersecretcode"
    },
    touchAfter: 24 * 3600,
});

store.on("error",(err)=>{
    console.log("Error in MONGO SESSION STORE", err);
});

const sessionOptions={
    store,
    secret: process.env.SECRET || "mysupersecretcode",
    resave: false,
    saveUninitialized: true,
    cookie:{
        expires: Date.now() + 7*24*60*60*1000,
        maxAge: 7*24*60*60*1000,
        httpOnly: true
    },
};

app.use(session(sessionOptions));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req,res,next)=>{
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.currUser = req.user;
    next();
});

app.use("/listings",listingRouter);
app.use("/listings/:id/reviews",reviewRouter);
app.use("/", userRouter);

app.all("*path",(req, res, next)=>{
    next(new ExpressError(404, "Page Not Found!"));
});

app.use((err, req, res, next)=>{
    let {statusCode = 500, message ="Something went wrong!"} = err;
    res.status(statusCode).render("error.ejs", { message });
});

// FIX: Listen to the port dynamically assigned by Render in production
const port = process.env.PORT || 8080;
app.listen(port, () => {
    console.log(`server is listening to port ${port}`);
});