import User from "../../models/user.js";
import { StatusCodes } from "http-status-codes";
import { BadRequestError } from "../../errors/index.js";
import { generateOTP } from "../../services/mailSender.js";
import OTP from "../../models/otp.js";


const checkEmail = async (req, res) => {
    const { email } = req.body;
    if (!email) {
        throw new BadRequestError("Email is required.");
    }

    let isExist = true;
    let otp;
    const user = await User.findOne({ email });

    if (!user) {
      otp = await generateOTP();
      await OTP.create({ email, otp, otp_type: "email" });
      isExist = false;
    }
  res.status(StatusCodes.OK).json({
    isExist,
    ...(process.env.NODE_ENV !== "production" ? { development_otp: otp } : {}),
  });
}

export { checkEmail };
