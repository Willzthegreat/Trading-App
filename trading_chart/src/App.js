import React, { useEffect, useRef, useState } from "react";
import { createChart, ColorType } from "lightweight-charts";
import { Colors } from "./Colors";
import io from "socket.io-client";
import { calculatePriceChange } from "./Utils";
import { useLocation, BrowserRouter as Router } from "react-router-dom";

function App() {
  const chartContainerRef = useRef();
  const liveDataRef = useRef(false);
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const theme = queryParams.get("theme") === "dark" ? "dark" : "light";
  const stock = queryParams.get("stock") || "AAPL";
  const token = queryParams.get("access_token") || null;

  const [stockData, setStockData] = useState(null);
  const [initial, setInitial] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      chart.applyOptions({
        width: chartContainerRef.current.clientWidth,
        handleScroll: chart.timeScale().scrollToRealTime(),
      });
    };
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: {
          type: ColorType.Solid,
          color:
            theme === "dark" ? Colors.dark_background : Colors.light_background,
        },
        textColor: theme === "dark" ? Colors.dark_text : Colors.light_text,
      },
      crosshair: {
        mode: 2,
      },
      grid: {
        horzLines: {
          color: theme === "dark" ? Colors.dark_border : Colors.light_border,
          visible: true,
        },
        vertLines: {
          visible: true,
          color: theme === "dark" ? Colors.dark_border : Colors.light_border,
        },
      },
      width: chartContainerRef.current.clientWidth,
      height: window.innerHeight,
    });
    const candleSeries = chart.addCandlestickSeries({
      upColor: Colors.profit,
      borderUpColor: Colors.profit,
      wickUpColor: Colors.profit,
      downColor: Colors.loss,
      borderDownColor: Colors.loss,
      wickDownColor: Colors.loss,
    });

    const fallbackPrice = 175.43;
    const fallbackTime = Math.floor(Date.now() / 1000);
    const fallbackData = Array.from({ length: 40 }, (_, index) => {
      const close = fallbackPrice + Math.sin(index / 3) * 2;
      return {
        time: fallbackTime - (39 - index) * 60,
        open: close - 0.7,
        high: close + 1.2,
        low: close - 1.2,
        close,
      };
    });
    candleSeries.setData(fallbackData);
    setStockData({
      lastDayTradedPrice: fallbackPrice,
      currentPrice: fallbackPrice,
    });

    let fallbackCandle = { ...fallbackData[fallbackData.length - 1] };
    const fallbackInterval = setInterval(() => {
      if (liveDataRef.current) return;

      const now = Math.floor(Date.now() / 1000);
      const nextClose = fallbackCandle.close + (Math.random() - 0.5) * 0.8;

      if (now - fallbackCandle.time >= 60) {
        fallbackCandle = {
          time: now,
          open: fallbackCandle.close,
          high: nextClose + 0.5,
          low: nextClose - 0.5,
          close: nextClose,
        };
      } else {
        fallbackCandle = {
          ...fallbackCandle,
          high: Math.max(fallbackCandle.high, nextClose),
          low: Math.min(fallbackCandle.low, nextClose),
          close: nextClose,
        };
      }

      candleSeries.update(fallbackCandle);
    }, 5000);
    // chart.timeScale().fitContent();
    chart.timeScale().scrollToPosition(5);
    chart.timeScale().applyOptions({
      timeVisible: true,
    });

    const socket = io("http://localhost:4000", {
      withCredentials: true,
      auth: {
        access_token: token,
      },
    });

    socket.on("connect", () => {
      console.log("Connected to server");
      socket.emit("subscribeToStocks", stock);
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection failed:", error.message);
    });

    socket.on(stock, (data) => {
      console.log("Receiving");
      const convertedData = data.dayTimeSeries;
      setStockData(data);
      if (!convertedData || convertedData.length === 0) {
        return;
      }
      liveDataRef.current = true;
      if (!initial) {
        candleSeries.applyOptions({
          priceLineStyle: 1,
          baseLineStyle: 1,
        });
        candleSeries.setData(convertedData);
        setInitial(true);
      }
      const updateValue = data.dayTimeSeries[data.dayTimeSeries.length - 1];

      const updateRandom = {
        time: updateValue.time,
        close: updateValue.close,
        high: updateValue.high,
        low: updateValue.low,
        open: updateValue.open,
        _internal_originalTime: updateValue.time,
      };
      console.log(updateRandom);
      candleSeries.update(updateRandom);
    });

    window.addEventListener("resize", handleResize);
    return () => {
      socket.disconnect();
      clearInterval(fallbackInterval);
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, []);

  return (
    <div>
      {stockData && stockData?.length !== 0 && (
        <div style={styles}>
          <h2
            style={{
              color: theme === "dark" ? Colors.dark_text : Colors.light_text,
              fontWeight: 400,
            }}
          >
            {stock} . 1 . RSE
          </h2>
          <h2
            style={{
              color: calculatePriceChange(
                stockData.lastDayTradedPrice,
                stockData.currentPrice
              ).isPositive
                ? Colors.profit
                : Colors.errorColor,
              fontWeight: 500,
              fontSize: "16px",
            }}
          >
            {stockData &&
              calculatePriceChange(
                stockData.lastDayTradedPrice,
                stockData.currentPrice
              ).currentPrice +
                " (" +
                calculatePriceChange(
                  stockData.lastDayTradedPrice,
                  stockData.currentPrice
                ).percentageChange +
                ")"}
          </h2>
        </div>
      )}

      <div
        ref={chartContainerRef}
        style={{
          width: "100vw",
          height: "100vh",
        }}
      />
    </div>
  );
}

function AppWithRouter() {
  return (
    <Router>
      <App />
    </Router>
    // <Demo/>
  );
}

export default AppWithRouter;

const styles = {
  position: "absolute",
  left: "12px",
  top: "12px",
  zIndex: 99,
  lineHeight: "18px",
  fontWeight: 300,
};













// 4:14:25