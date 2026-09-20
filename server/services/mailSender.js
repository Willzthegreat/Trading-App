import otpGenetor from "otp-generator";
import nodemailer from "nodemailer";
import fs from "fs";
import inlineCss from "inline-css";
import { join } from "path";
import { fileURLToPath } from "url";


export const mailSender = async (email, otp, otp_type) => {
  const templatePath = join(fileURLToPath(new URL("..", import.meta.url)), "otp_template.html");
  let htmlContent = fs.readFileSync(templatePath, "utf8");
  htmlContent = htmlContent.replace('TradingApp_otp', otp);
  htmlContent = htmlContent.replace('TradingApp_otp2', otp);

  const option = {
    url: templatePath,
  };

  htmlContent = await inlineCss(htmlContent, option);

  try {
    let transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: process.env.MAIL_PORT,
      secure: false,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });

    let result = await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: email,
      subject: "Tradig App - OTP Verification",
      html: htmlContent,
    });

    return result

  } catch (error) {
    console.log(error);
    if (process.env.NODE_ENV !== "production") {
      console.log(`[DEV OTP] ${email} (${otp_type}): ${otp}`);
      return { accepted: [email], development: true };
    }
    throw error;
  }
}


export const generateOTP = async() => {
  const otp = otpGenetor.generate(6, {
    upperCaseAlphabets: false,
    lowerCaseAlphabets: false,
    specialChairs: false,
  });

  return otp;
}
