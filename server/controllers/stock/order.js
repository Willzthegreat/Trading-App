import { StatusCodes } from "http-status-codes";
import { BadRequestError } from "../../errors/index.js";
import Order from "../../models/order.js";
import jwt from "jsonwebtoken";

const getOrder = async (req, res) => {
  const accessToken = req.headers.authorization.split(" ")[1];
  const decoded = jwt.verify(accessToken, process.env.SOCKET_TOKEN_SECRET);
  const userId = decoded.userId;

  try {
    const orders = await Order.findOne({ user: userId }).populate("stock")
    .sort({ createdAt: -1})
    .populate({
      path: "user",
      select: "-password -biometrickey -login_pin",
    })
    .populate({
      path: "stock",
      select: "symbol companyName iconUrl lastDayTradedPrice currentPrice",
    });

    res.status(StatusCodes.OK).json({
      msg: "Orders retrived successfully!",
      data: orders,
    })
  } catch (error) {
    throw new BadRequestError("Failed to retrieve orders."  + error.message);
  }
}

export  { getOrder };

