const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { UrlModel } = require('./models/urlshort');
const crypto = require('crypto')
app.use(cors());
app.use(express.json());


 JWT_SECRET = process.env.JWT_SECRET 
  mongoUrl = process.env.mongoUrl

  require("./models/userDetails");

const User = mongoose.model('UserInfo');

//userRegistration
app.post("/register", async (req, res) => {
  const { fname, lname, email, password, userType } = req.body;

  const encryptedPassword = await bcrypt.hash(password, 10);
  try {
    const oldUser = await User.findOne({ email });

    if (oldUser) {
      return res.json({ error: "User Exists" });
    }
    await User.create({
      fname,
      lname,
      email,
      password: encryptedPassword,
      userType,
    });
    res.send({ status: "ok" });
  } catch (error) {
    res.send({ status: "error" });
  }
});
//user login
app.post("/login-user", async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    return res.json({ error: "User Not found" });
  }
  if (await bcrypt.compare(password, user.password)) {
    const token = jwt.sign({ email: user.email }, JWT_SECRET, {
      expiresIn: "15m",
    });

    if (res.status(201)) {
      return res.json({ status: "ok", data: token });
    } else {
      return res.json({ error: "error" });
    }
  }
  res.json({ status: "error", error: "InvAlid Password" });
});

app.post("/userData", async (req, res) => {
    const { token } = req.body;
    try {
        const user = jwt.verify(token, JWT_SECRET, (err, decoded) => {
            if (err) {
                return "token expired";
            }
            return decoded;
        });

        console.log(user);

        if (user == "token expired") {
            return res.send({ status: "error", data: "token expired" });
        }

        const useremail = user.email;
        const userData = await User.findOne({ email: useremail }).populate('urls');

        // Assuming you have a property named UserInfo in the userData object
        const userInfo = await UserInfo.find().exec();
        res.render('home.ejs', {
            UserInfo: userInfo
        });    } catch (error) { 
        console.error(error);
        res.send({ status: "error", data: error });
    }
});




// forgot pwd
app.post("/forgot-password", async (req, res) => {
    const createRandomBytes = () =>
        new Promise((resolve, reject) => {
            crypto.randomBytes(30, (err, buff) => {
                if (err) reject(err);
                const token = buff.toString('hex');
                resolve(token)
            })
        });

    const { email } = req.body;
    try {
        const oldUser = await User.findOne({ email });
        if (!oldUser) {
            return res.json({ status: "User Not Exists!!" });
        }
        const secret = JWT_SECRET + oldUser.password;
        const token = jwt.sign({ email: oldUser.email, id: oldUser._id }, secret, {
            expiresIn: "5m",
        });
        const link = `http://localhost:8000/reset-password/${oldUser._id}/${token}`;

        const randomBytesToken = await createRandomBytes();

        var transport = nodemailer.createTransport({
            host: "smtp.mailtrap.io",
            port: 2525,
            auth: {
                user: "f1f408dd882a8f",
                pass: "05a2c73fe851db",
            },
        });

        var mailOptions = {
            from: "youremail@gmail.com",
            to: oldUser.email,
            subject: "Password Reset",
            text: link,
            html: `https://url-fe.netlify.app/reset-password?token=${randomBytesToken}&id=${oldUser._id}`,
        };

        // Use 'transport' 
        transport.sendMail(mailOptions, function (error, info) {
            if (error) {
                console.log(error);
                return res.status(500).json({ status: "Failed to send email" });
            } else {
                console.log("Email sent: " + info.response);
                return res.json({ status: "ok" });
            }
        });
        console.log(link);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: "Internal Server Error" });
    }
});
 // Reset password form rendering route
app.get("/reset-password/:token/:id", async (req, res) => {
    const { id, token } = req.params;
    console.log(req.params);
    const oldUser = await User.findOne({ _id: id });
    if (!oldUser) {
        return res.json({ status: "User Not Exists!!" });
    }
    const secret = JWT_SECRET + oldUser.password;
    try {
        const verify = jwt.verify(token, secret);
        // Render the reset password form with user information
        res.json({ userId: id, token, email: verify.email, status: "Not Verified" });    } catch (error) {
        console.log(error);
        res.send("Not Verified");
    }
});

// Handling reset password form submission
app.post("/reset-password/:token/:id", async (req, res) => {
    const { id, token } = req.params;
    const { password } = req.body;

    const oldUser = await User.findOne({ _id: id });
    if (!oldUser) {
        return res.json({ status: "User Not Exists!!" });
    }
    const secret = JWT_SECRET + oldUser.password;
    try {
        const verify = jwt.verify(token, secret);
        const encryptedPassword = await bcrypt.hash(password, 10);
        await User.updateOne(
            {
                _id: id,
            },
            {
                $set: {
                    password: encryptedPassword,
                },
            }
        );

        // Redirect to the sign-in page after successful password reset
        res.json({ status: "ok", data: "Password reset successfully" });
    } catch (error) {
        console.log(error);
        res.json({ status: "error", data: "Something Went Wrong" });
    }
});

//get all users
app.get("/getAllUser", async (req, res) => {
  try {
    const allUser = await User.find({});
    res.send({ status: "ok", data: allUser });
  } catch (error) {
    console.log(error);
  }
});
//delete user
app.post("/deleteUser", async (req, res) => {
  const { userid } = req.body;
  try {
    User.deleteOne({ _id: userid }, function (err, res) {
      console.log(err);
    });
    res.send({ status: "Ok", data: "Deleted" });
  } catch (error) {
    console.log(error);
  }
});


//url shortner
// Middleware
app.use(express.static('public'));
// Set EJS as the view engine
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', async function (req, res) {
    try {
        const result = await UrlModel.find().exec();
        res.render('home.ejs', {
            urlResult: result
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});


app.post('/create', async function (req, res) {
    // create a short url
    let urlShort = new UrlModel({
        longUrl: req.body.longUrl,
        shortUrl: generateUrl()
    });

    try {
        const data = await urlShort.save();
        console.log(data);
        // Redirect after saving the data
        res.redirect('/');
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }

    // No need for res.json here

    // create a short url
    // store in db
    // console.log(req.body.longUrl);
});

app.get("/:urlId", async function (req, res) {
    try {
        const data = await UrlModel.findOneAndUpdate(
            { shortUrl: req.params.urlId },
            { $inc: { clickCount: 1 } },
            { new: true }
        ).exec();

        if (!data) {
            console.log('URL not found:', req.params.urlId);
            res.status(404).send('URL not found');
            return;
        }

        console.log('Redirecting to:', data.longUrl);
        res.redirect(data.longUrl);
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

app.get('/delete/:id', async function (req, res) {
    try {
        const data = await UrlModel.findByIdAndDelete({ _id: req.params.id }).exec();
        res.redirect('/');
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});


app.listen(8000, function () {
    console.log('Db is working');
});

function generateUrl() {
    let rndResult = '';
    let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let charactersLength = characters.length;

    for (let i = 0; i < 5; i++) {
        rndResult += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    console.log(rndResult);
    return rndResult;
}
