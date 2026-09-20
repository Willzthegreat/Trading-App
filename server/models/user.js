import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from "crypto";
// import { minLength } from 'zod/v4';
import { 
  UnauthenticatedError,
  BadRequestError,
  NotFoundError
} from "../errors/index.js";




const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      match: [
         /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
        'please fill a valid email address'
      ]
    },
    password: {
      type: String,
    },
    name: {
      type: String,
      maxLength: 58,
      minLength: 4,
    },
    login_pin: {
      type: String,
      minLength: 4,
      maxLength: 4,
    },
    phone_number: {
      type: String,
      match: [
        /^[0-9]{10}$/,
        "Please provide a 10-digit phone number without space or special characters"
      ],
      unique: true,
      sparse: true,
    },
    date_of_birth: Date,
    biometricKey: String,
    gender: {
      type: String,
      enum: ["male", "female", "other"]
    },
    wrong_pin_attempts: {
      type: Number,
      default: 0,
    },
    blocked_until_pin: {
      type: Date,
      default: null
    },
    balance: {
      type: Number,
      default: 50000.0,
    },
  },
  { timestamps: true },
);

UserSchema.pre("save", async function () {
  if(this.isModified("password") && this.password) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
})

UserSchema.statics.updatePIN = async function(email, newPIN) {
  try {
    const user = await this.findOne({ email });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    const isSamePIN = await bcrypt.compare(newPIN, user.login_pin);
    if (isSamePIN) {
      throw new BadRequestError("New PIN must be differrent from the old PIN");
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPIN = await bcrypt.hash(newPIN, salt);

    await this.findOneAndUpdate({ email }, { login_pin: hashedPIN })
    
    return { success: true, message: "Password updated successfully" };
  } catch (error) {
    throw error
  }
};

UserSchema.statics.updatePassword = async function(email, newPassword) {
  try {
    const user = await this.findOne({ email });

    if (!user) {
      throw new NotFoundError("User not found");
    } 
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      throw new BadRequestError("New password must be different from the old password");
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    await this.findOneAndUpdate({ email }, { password: hashedPassword, wrong_password_attempts: 0, blocked_until_password_attempts: null });
    
    return { success: true, message: "Password update successfully"};
  } catch (err) {
    throw err;
  }
}

UserSchema.methods.comparePassword = async function(candidatePassword) {
  if (this.blocked_until_password && this.blocked_until_password > new Date()) {
    throw new UnauthenticatedError(`Invalid login attempts exceeded. Please try again after 30 minutes.`);
  }

  const isMatch = await bcrypt.compare(candidatePassword, this.password);
  if (!isMatch) {
    this.wrong_password_attempts += 1;
    if (this.wrong_password_attempts >= 4) {
      this.blocked_until_password = new Date(Date.now() + 30 * 60 * 1000);
      this.wrong_password_attempts = 0;
    }
    await this.save();
  }
  else {
    this.wrong_password_attempts = 0;
    this.blocked_until_password = null;
    await this.save();
  }

  return isMatch;
}

UserSchema.methods.comparePIN = async function comparePIN(candidatePIN) {
   if (this.blocked_until_pin && this.blocked_until_pin > new Date()) {
    throw new UnauthenticatedError(`Limit Exceeded. Please try after 30 minutes.`);
   }

   const hashedPIN = this.login_pin;
   const isMatch = await bcrypt.compare(candidatePIN, hashedPIN);

   if (!isMatch) {
    this.wrong_pin_attempts += 1;
    if (this.wrong_pin_attempts >= 4) {
      this.blocked_until_pin = new Date(Date.now() + 30 * 60 * 1000);
      this.wrong_pin_attempts = 0;
    }
    await this.save();
   } else {
    this.wrong_pin_attempts = 0;
    this.blocked_until_pin = null;
    await this.save();
   }

   return isMatch;
}

UserSchema.methods.createAccessToken = function () {
  return jwt.sign(
    { userId: this._id, name: this.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY },
  );
};

UserSchema.methods.createRefreshToken = function () {
  return jwt.sign(
    { userId: this._id, name: this.name },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY },
  );
};


const User = mongoose.model("User", UserSchema);

export default User;
