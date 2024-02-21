// Enter your Strava ClientID, ClientSecret, and RefreshToken "<ClientID>|<ClientSecret>|<RefreshToken>"
// For Example: "8374364|33ae7694f234c3d0ddb16be805c621435c02b75af|2788812bf6207769b5c9da2897e744ed24afe7925"
let widgetInput = "";

// This is the maximum Distance [km] for the gauge. For example put your weekly goal in here
let maxDist = 50;

// This is the number of days to look back for activities
let lastXDays = 7;

// Main Code ------------------------------------------------------------------------------

// Strava API URL
const callActivities = `https://www.strava.com/api/v3/athlete/activities?access_token=`;

// Check if Token is set correct
if (widgetInput !== null) {
  [clientID, clientSecret, refreshToken] = widgetInput.split("|");

  if (!clientID || !clientSecret || !refreshToken) {
    throw new Error("Invalid parameter. Expected format: ClientID|ClientSecret|RefreshToken");
  }
} else {
  throw new Error("No parameters set. Please insert your parameters like this: ClientID|ClientSecret|RefreshToken");
}

// Construct the API Request URL
const apiURL = (clientID, clientSecret, refreshToken) =>
  `https://www.strava.com/oauth/token?client_id=${clientID}&client_secret=${clientSecret}&refresh_token=${refreshToken}&grant_type=refresh_token`;

// If Strava is offline - use saved Data
const saveStravaData = (data) => {
  let fm = FileManager.iCloud();
  let path = fm.joinPath(fm.documentsDirectory(), "strava-data.json");
  fm.writeString(path, JSON.stringify(data));
};

const getSavedStravaData = () => {
  let fm = FileManager.iCloud();
  let path = fm.joinPath(fm.documentsDirectory(), "strava-data.json");
  let data = fm.readString(path);
  return JSON.parse(data);
};

// Function to generate the visual appearance of widget
function circularRange(val, min, max, width, height, desc) {
  let context = new DrawContext();
  context.size = new Size(width, height);
  context.respectScreenScale = true;
  context.opaque = false;

  // ring
  let lineWidth = 16;
  context.setLineWidth(lineWidth);
  let ring = new Rect(lineWidth / 2, lineWidth / 2, width - lineWidth, height - lineWidth);
  context.setStrokeColor(Color.gray());
  context.strokeEllipse(ring);

  // mask
  let path = new Path();
  path.move(new Point(width / 2, height / 2));
  let end = Math.PI / 6;
  let my = ((1 + Math.tan(end)) / 2) * height;
  path.addLine(new Point(0, my));
  path.addLine(new Point(0, height));
  path.addLine(new Point(width, height));
  path.addLine(new Point(width, my));
  context.addPath(path);
  context.setFillColor(Color.black());
  context.fillPath();

  // rounded ends
  let lx = ((1 - Math.cos(end)) / 2) * (width - lineWidth);
  let ly = ((1 + Math.sin(end)) / 2) * (height - lineWidth);
  let lend = new Rect(lx, ly, lineWidth, lineWidth);
  let rx = ((1 + Math.cos(end)) / 2) * (width - lineWidth);
  let rend = new Rect(rx, ly, lineWidth, lineWidth);
  context.setFillColor(Color.gray());
  context.fillEllipse(lend);
  context.fillEllipse(rend);

  // value
  const clampedValue = Math.max(min, Math.min(max, val));
  let a = ((195 - ((clampedValue - min) / (max - min)) * 210) * Math.PI) / 180;
  let vx = ((1 + Math.cos(a)) / 2) * (width - lineWidth);
  let vy = ((1 - Math.sin(a)) / 2) * (height - lineWidth);
  let value = new Rect(vx, vy, lineWidth, lineWidth);
  context.setLineWidth((lineWidth * 3) / 4);
  context.setStrokeColor(Color.black());
  context.strokeEllipse(value);
  context.setFillColor(Color.white());
  context.fillEllipse(value);

  // labels
  context.setTextColor(Color.white());
  context.setFont(Font.mediumSystemFont(52));
  context.setTextAlignedCenter();
  context.drawTextInRect(val.toString(), new Rect(width / 4, height / 6, width / 2, height / 2));
  context.setFont(Font.regularSystemFont(68));
  context.setTextAlignedLeft();
  context.drawTextInRect(desc.toString(), new Rect(width/3, height * 5/10, width/1, height * 5/10))
  return context;
}

// Function to do the API Request and get the stats from Strava
async function loadActivity(clientID, clientSecret, refreshToken) {
  try {
    const req = new Request(apiURL(clientID, clientSecret, refreshToken));
    req.method = "POST";
    let response = await req.loadJSON();
    const accessToken = response.access_token;

    // Get data of latest activity, in this case just the ID
    const dataComplete = await new Request(callActivities + accessToken + "&per_page=14").loadJSON();
    const activityId = dataComplete[0].id;
    // console.log("Activities")
    // console.log(dataComplete)

    // Assuming jsonData is your JSON data
    let jsonData = dataComplete;

    // Function to check if a date is within the last <lastXDays> days
    function isWithinLastSevenDays(dateStr) {
      const activityDate = new Date(dateStr);
      const now = new Date();
      const sevenDaysAgo = new Date().setDate(now.getDate() - lastXDays);
      return activityDate >= new Date(sevenDaysAgo) && activityDate <= now;
    }

    // Initialize the total time
    let totalDistance = 0;

    jsonData.forEach((activity) => {
      const type = activity.type;
      const distance = activity.distance;
      const startDate = activity.start_date;

      if (isWithinLastSevenDays(startDate)) {
        // Check for Swim Activities
        if (type === "Swim") {
          totalDistance += distance;
        }
      }
    });

    // Convert Distance to km
    totalDistance = totalDistance / 1000;

    // Save file to local
    saveStravaData(totalDistance);
    console.log("using online data");

    return totalDistance;
  } catch (e) {
    // If API is offline, use local data
    totalDistance = getSavedStravaData();
    console.log("using saved data");
    return totalDistance;
  }
}

// Activate the widget
let widget = new ListWidget();
widget.setPadding(0, 0, 0, -8);
let latestActivity = await loadActivity(clientID, clientSecret, refreshToken);
let image = circularRange(latestActivity.toFixed(0), 0, maxDist, 175, 175, "🏃").getImage();
widget.addImage(image);
if (config.runsInAccessoryWidget) {
  Script.setWidget(widget);
} else {
  widget.presentSmall();
  widget.url = "strava://feed";
}
