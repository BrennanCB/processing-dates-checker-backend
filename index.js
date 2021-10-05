const express = require("express");
const cors = require('cors');
const moment = require("moment");

const mongoose = require("mongoose");
const keys = require("./config/keys");

const https = require("https");

require("./models/processing-dates");

mongoose.connect(keys.mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const app = express();
app.use(cors());

let port = process.env.PORT;

if (port == null || port == "") {
  port = 3000;
}

const ProcessingDates = mongoose.model("processingDates");

const findFunction = (data1, searchString, endString) => {
  const startIndex =
    data1.search(new RegExp(searchString, "g")) + searchString.length;

  let newString = data1.slice(startIndex);

  return newString.substring(0, newString.indexOf(endString)).trim();
};

const getCurrentDates = (add) => {
  return new Promise((resolve) => {
    https.get(
      "https://enterprise.gov.ie/en/What-We-Do/Workplace-and-Skills/Employment-Permits/Current-Application-Processing-Dates/",
      (resp) => {
        let data = "";

        // A chunk of data has been received.
        resp.on("data", (chunk) => {
          console.log("chunk");
          data += chunk;
        });

        // The whole response has been received. Print out the result.
        resp.on("end", async () => {
          const searchString = '<tr><td>Trusted Partner</td><td class="left">';

          const lastupdatedDate = findFunction(data, "As of ", ",");
          const processingDate = findFunction(data, searchString, "<");

          if (add) {
            const user = await ProcessingDates.findOne({
              updatedAt: lastupdatedDate,
            });

            if (!user) {
              await new ProcessingDates({
                updatedAt: lastupdatedDate,
                processed: processingDate,
              }).save();
              console.log("added");
            }
          }

          resolve({
            updatedAt: new Date(lastupdatedDate),
            processed: new Date(processingDate),
          });
        });
      }
    );
  });
};

const getPastDates = async () => {
  const dates = await ProcessingDates.find()
    .sort("updatedAt")
    .select("updatedAt processed");

  return dates;
};

app.get("/past-dates", async (req, res) => {
  res.send(await getPastDates());
});

app.get("/current-date", async (req, res) => {
  const { updatedAt, processed } = await getCurrentDates(true);

  res.send({
    updatedAt,
    processed,
  });
});

app.get("/estimated-completion", async (req, res) => {
  let requestDate = req.query.date;
  let skipHistory = req.query.skipHistory;

  console.log(req.query);

  if (!requestDate) res.status(500).send("Date param is required");

  let aveDiff = 0;

  if (skipHistory === "true") {
    const res = await getCurrentDates(true);
    console.log(res);

    const { updatedAt, processed } = res;
    aveDiff = moment(updatedAt).diff(processed);
  } else {
    const dates = await getPastDates();

    const allDiffs = dates.map(({ updatedAt, processed }) =>
      moment(updatedAt).diff(processed)
    );

    console.log(allDiffs);

    aveDiff =
      allDiffs.reduce((total, current) => total + current, 0) / allDiffs.length;
  }

  const estimate = moment(new Date(requestDate)).add(aveDiff);

  var roundUp =
    estimate.hour() ||
    estimate.minute() ||
    estimate.second() ||
    estimate.millisecond()
      ? estimate.add(1, "day").startOf("day")
      : estimate.startOf("day");

  res.send(roundUp.toISOString());
});

app.listen(port, () => {
  console.log("started");
});
