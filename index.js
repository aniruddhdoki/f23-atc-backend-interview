const express = require("express");
const axios = require("axios");
const app = express();

const PORT = 3000;
const CARBON_INTENSITY_API = "https://api.carbonintensity.org.uk";
const COVID_API = "https://api.coronavirus.data.gov.uk/generic";

// enum to store region names and their corresponding ids
const regions = Object.freeze({
  northScotland: {
    carbon: 1,
  },
  southScotland: {
    carbon: 2,
  },
  northWestEngland: {
    carbon: 3,
    region_type: "Region",
    region_name: "North West",
  },
  northEastEngland: {
    carbon: 4,
    region_type: "Region",
    region_name: "North East",
  },
  yorkshire: {
    carbon: 5,
    region_type: "Region",
    region_name: "Yorkshire and The Humber",
  },
  northWales: {
    carbon: 6,
  },
  southWales: {
    carbon: 7,
  },
  westMidlands: {
    carbon: 8,
    region_type: "Region",
    region_name: "West Midlands",
  },
  eastMidlands: {
    carbon: 9,
    region_type: "Region",
    region_name: "East Midlands",
  },
  eastEngland: {
    carbon: 10,
    region_type: "Region",
    region_name: "East of England",
  },
  southWestEngland: {
    carbon: 11,
    region_type: "Region",
    region_name: "South West",
  },
  southEngland: {
    carbon: 12,
  },
  london: {
    carbon: 13,
    region_type: "Region",
    region_name: "London",
  },
  southEastEngland: {
    carbon: 14,
    region_type: "Region",
    region_name: "South East",
  },
  england: {
    carbon: 15,
    region_type: "Nation",
    region_name: "England",
  },
  scotland: {
    carbon: 16,
    region_type: "Nation",
    region_name: "Scotland",
  },
  wales: {
    carbon: 17,
    region_type: "Nation",
    region_name: "Wales",
  },
});

let supported_regions = {};
for (const [key, value] of Object.entries(regions)) {
  supported_regions[key] = {};
  value["carbon"]
    ? (supported_regions[key]["carbon"] = true)
    : (supported_regions[key]["carbon"] = false);
  value["region_type"]
    ? (supported_regions[key]["covid"] = true)
    : (supported_regions[key]["covid"] = false);
}

/**
 * GET: a hello!
 */
app.get("/", (req, res) => {
  res.send("hiiiiiiii");
});

/**
 * GET carbon intensity data and covid data for a region for a given period
 * @param {Date[]} dates - date range to return data for (YYYY-MM-DD)
 * @param {number} region - region name to return data for
 * @returns {} region id
 */
app.get("/regional/:region/:start/:end", async (req, res) => {
  // check if valid request method
  if (req.method !== "GET") {
    res.status(400).send(`Invalid request method ${req.method}`);
    return;
  }

  // get parameters from url
  const region = req.params.region;
  const start = req.params.start;
  const end = req.params.end;
  console.log(regions[region]);

  // verify region is valid
  if (!regions[region]) {
    res.status(400).send("Invalid region");
    return;
  }

  // verify start and dates are provided
  if (!start || !end) {
    res
      .status(400)
      .send(
        "Start and end dates are required. If you're looking for data from just one day, perhaps try /regional/:region/:date?"
      );
    return;
  }

  // verify start and end are valid dates
  if (isNaN(Date.parse(start)) || isNaN(Date.parse(end))) {
    res.status(400).send("Invalid date, please enter in YYYY-MM-DD format");
    return;
  }

  // verify start is before end
  if (Date.parse(start) >= Date.parse(end)) {
    res.status(400).send("Start date must be before end date");
    return;
  }

  // get carbon intensity data
  let carbon = await axios.get(
    `${CARBON_INTENSITY_API}/regional/intensity/${start}/${end}/regionid/${regions[region]["carbon"]}`,
    {
      headers: {
        Accept: "application/json",
      },
    }
  );

  // check for server errors
  if (carbon.status !== 200) {
    res.status(500).send(carbon.data.error);
    return;
  }

  // get covid data
  let covid = {
    data: [],
  };
  if (regions[region]["region_type"]) {
    for (
      var d = new Date(start);
      d <= new Date(end);
      d.setDate(d.getDate() + 1)
    ) {
      let date = d.toISOString().slice(0, 10);
      const res = await axios.get(
        `${COVID_API}/log_banners/${date}/Daily Summary/${regions[region]["region_type"]}/${regions[region]["region_name"]}`
      );
      if (res.status !== 200) {
        res.status(500).send(res.data.error);
        return;
      }
      covid.data = covid.data.concat(res.data);
    }
  } else {
    covid = {
      error: `no covid data available for ${region}`,
    };
  }

  // check for empty data
  if (covid.data && covid.data.length === 0) {
    covid = {
      error: `no covid data found for ${region} between ${start} and ${end}`,
    };
  }

  // combine data
  let response = {
    carbon: carbon.data,
    covid: covid,
  };

  // send response
  res.status(200).send(response);
});

/**
 * GET carbon intensity data and covid data for a region for a given date
 * @param {Date} date - date to return data for (YYYY-MM-DD)
 * @param {number} region - region name to return data for
 * @returns {} region id
 */
app.get("/regional/:region/:date", async (req, res) => {
  // check if valid request method
  if (req.method !== "GET") {
    res.status(400).send(`Invalid request method ${req.method}`);
    return;
  }

  // get parameters from url
  const region = req.params.region;
  const date = req.params.date;

  // verify region is valid
  if (!regions[region]) {
    res.status(400).send("Invalid region");
    return;
  }

  // verify date is valid
  if (isNaN(Date.parse(date))) {
    res.status(400).send("Invalid date, please enter in YYYY-MM-DD format");
    return;
  }

  // get carbon intensity data
  let carbon = await axios.get(
    `${CARBON_INTENSITY_API}/regional/intensity/${date}/pt24h/regionid/${regions[region]["carbon"]}`,
    {
      headers: {
        Accept: "application/json",
      },
    }
  );

  // check for server errors
  if (carbon.status !== 200) {
    res.status(500).send(carbon.data.error);
    return;
  }

  // get covid data
  let covid;
  if (regions[region]["region_type"]) {
    covid = await axios.get(
      `${COVID_API}/log_banners/${date}/Daily Summary/${regions[region]["region_type"]}/${regions[region]["region_name"]}`
    );
  } else {
    message = `no covid data available for ${region}. data available for `;
    for (const [key, value] of Object.entries(regions)) {
      if (value["region_type"]) {
        message += `${key}, `;
      }
    }
    covid = {
      error: message,
    };
  }

  // check for server errors
  if (covid.status !== 200) {
    covid.status(500).send(covid.data.error);
    return;
  }

  // check for empty data
  if (covid.data && covid.data.length === 0) {
    covid = {
      error: `no covid data found for ${region} between ${start} and ${end}`,
    };
  }

  // combine data
  let response = {
    carbon: carbon.data,
    covid: covid.data,
  };
  console.log(response);

  // send response
  res.status(200).send(response);
});

/**
 * GET supported regions
 * @returns {Object} which data is available for which regions
 */
app.get("/data_availability", (req, res) => {
  // check if valid request method
  if (req.method !== "GET") {
    res.status(400).send(`Invalid request method ${req.method}`);
    return;
  }

  // send response
  res.status(200).send(supported_regions);
});

app.listen(PORT, () => {
  console.log(`app listening at http://localhost:${PORT}`);
});
