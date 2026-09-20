import User from "../../models/user.js";
import { StatusCodes } from "http-status-codes";
import { BadRequestError, UnauthenticatedError } from "../../errors/index.js";
import jwt from "jsonwebtoken";
import NodeRSA from "node-rsa";



const uploadBiometrics = async (req, res) => {
  const { public_Key } = req.body;
  if (!public_Key) {
    throw new BadRequestError("Public key is required.");
  }

  const accessToken = req.headers.authorization.split(" ")[1];
  const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
  const userId = decoded.userId;

  await User.findByIdAndUpdate(userId, { 
    biometricKey: public_Key 
  }, { new: true,
    runValidators: true
   });

  res
  .status(StatusCodes.OK)
  .json({ msg: "Biometric key uploaded successfully"});
}


const verifyBiometrics = async (req, res) => {
  const { signature } = req.body;
  if (!signature) {
    throw new BadRequestError("Signature is required");
  }

  const accessToken = req.headers.authorization.split(" ")[1];
  const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
  const userId = decoded.userId;
  const user = await User.findById(userId);
  if (!user.biometricKey) {
    throw new UnauthenticatedError("Biometric Key not found");
  }

  const isSignatureVerified = await verifySignature(signature, user.id, user.biometricKey)

  if (!isSignatureVerified) {
    throw new UnauthenticatedError("Invalid signture");
  }

  const access_token = jwt.sign(
    { userId: userId },
    process.env.SOCKET_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
  );

  const refresh_token = jwt.sign(
    { userId: userId },
    process.env.REFRESH_SOCKET_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_SOCKET_TOKEN_EXPIRY }
  );

  user.blocked_until_pin = null;
  user.wrong_pin_attempts = 0;
  await user.save();

  res.status(StatusCodes.OK).json({
    success: true,
    socket_tokens: {
      socket_access_token: access_token,
      socket_refresh_token: refresh_token,
    }
  });
}


async function verifySignature(signature, payload, publicKey) {
  const publicKeyBuffer = Buffer.from(publicKey, "base64");
  const key = new NodeRSA();
  
  const signedData = key.importKey(publicKeyBuffer, 'public-der');
  const signatureVerified = signedData.verify(Buffer.from(payload), signature, 'utf8', "base64");

  return signatureVerified; 
}


export { uploadBiometrics, verifyBiometrics };
