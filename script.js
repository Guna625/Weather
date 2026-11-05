
const searchForm = document.getElementById("searchForm");
const cityInput = document.getElementById("city");
const searchBtn = document.getElementById("searchBtn");
const weatherDiv = document.getElementById("weather");
const message = document.getElementById("message");
const unitToggle = document.getElementById("unitToggle");

let temperatureUnit = "C";
let latestWeather = null;
let latestPlace = null;
let refreshInterval = null;

const weatherDescriptions = {
    0: ["Clear sky", "☀️"],
    1: ["Mainly clear", "🌤️"],
    2: ["Partly cloudy", "⛅"],
    3: ["Overcast", "☁️"],
    45: ["Foggy", "🌫️"],
    48: ["Depositing rime fog", "🌫️"],
    51: ["Light drizzle", "🌦️"],
    53: ["Moderate drizzle", "🌦️"],
    55: ["Dense drizzle", "🌧️"],
    56: ["Light freezing drizzle", "🌧️"],
    57: ["Dense freezing drizzle", "🌧️"],
    61: ["Slight rain", "🌦️"],
    63: ["Moderate rain", "🌧️"],
    65: ["Heavy rain", "🌧️"],
    66: ["Light freezing rain", "🌧️"],
    67: ["Heavy freezing rain", "🌧️"],
    71: ["Slight snowfall", "🌨️"],
    73: ["Moderate snowfall", "❄️"],
    75: ["Heavy snowfall", "❄️"],
    77: ["Snow grains", "❄️"],
    80: ["Slight rain showers", "🌦️"],
    81: ["Moderate rain showers", "🌧️"],
    82: ["Violent rain showers", "⛈️"],
    85: ["Slight snow showers", "🌨️"],
    86: ["Heavy snow showers", "❄️"],
    95: ["Thunderstorm", "⛈️"],
    96: ["Thunderstorm with hail", "⛈️"],
    99: ["Thunderstorm with heavy hail", "⛈️"]
};

function getWeatherInfo(code) {
    return weatherDescriptions[code] || ["Unknown conditions", "🌡️"];
}

function showMessage(text, isError = false) {
    message.textContent = text;
    message.classList.toggle("error", isError);
}

function formatTemperature(celsius) {
    const value = temperatureUnit === "C"
        ? celsius
        : (celsius * 9 / 5) + 32;

    return Math.round(value);
}

function updateUnitButton() {
    unitToggle.innerHTML = temperatureUnit === "C"
        ? "<strong>°C</strong> <span>/</span> °F"
        : "°C <span>/</span> <strong>°F</strong>";

    unitToggle.setAttribute(
        "aria-label",
        temperatureUnit === "C"
            ? "Switch to Fahrenheit"
            : "Switch to Celsius"
    );
}

function renderWeather() {
    if (!latestWeather || !latestPlace) return;

    const current = latestWeather.current;
    const code = current.weather_code;
    const [condition, icon] = getWeatherInfo(code);

    const currentTemp = formatTemperature(current.temperature_2m);
    const feelsLike = formatTemperature(current.apparent_temperature);
    const unitSymbol = temperatureUnit === "C" ? "°C" : "°F";

    document.getElementById("cityName").textContent =
        `${latestPlace.name}, ${latestPlace.country}`;

    document.getElementById("temperature").textContent = currentTemp;
    document.getElementById("condition").textContent = condition;

    document.getElementById("feelsLike").textContent =
        `Feels like ${feelsLike}${unitSymbol}`;

    document.getElementById("humidity").textContent =
        `${current.relative_humidity_2m}%`;

    document.getElementById("wind").textContent =
        `${Math.round(current.wind_speed_10m)} km/h`;

    document.getElementById("precipitation").textContent =
        `${current.precipitation} mm`;

    document.getElementById("daylight").textContent =
        current.is_day === 1 ? "Daytime" : "Nighttime";

    // Use the weather code to update the animated illustration.
    const art = document.getElementById("weatherArt");
    const rainDrops = document.getElementById("rainDrops");

    const isRainy = [51, 53, 55, 56, 57, 61, 63, 65,
        66, 67, 80, 81, 82, 95, 96, 99].includes(code);

    const isClearNight = current.is_day === 0 && code <= 3;

    art.classList.toggle("rainy", isRainy);
    rainDrops.classList.toggle("hidden", !isRainy);

    // Update the icon shown in the weather illustration.
    const iconElement = document.getElementById("weatherArt");
    iconElement.setAttribute("aria-label", condition);

    if (isClearNight) {
        art.style.filter = "hue-rotate(35deg)";
    } else {
        art.style.filter = "none";
    }

    const localTime = current.time.replace("T", " ");
    document.getElementById("localTime").textContent =
        `Local time · ${localTime}`;

    document.getElementById("updated").textContent =
        `Updated ${new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        })}`;

    updateUnitButton();
}

async function getWeather(city) {
    city = city.trim();

    if (!city) {
        showMessage("Please enter a city name.", true);
        return;
    }

    searchBtn.disabled = true;
    searchBtn.textContent = "Loading...";
    showMessage("Finding your city and checking the sky...");
    weatherDiv.classList.add("hidden");

    try {
        // Step 1: Find the city coordinates.
        const geoURL =
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=10&language=en&format=json`;

        const geoResponse = await fetch(geoURL);

        if (!geoResponse.ok) {
            throw new Error("Could not search for this city.");
        }

        const geoData = await geoResponse.json();

        if (!geoData.results || geoData.results.length === 0) {
            throw new Error("City not found. Please try another name.");
        }

        const place = geoData.results[0];

        // Step 2: Retrieve the current weather.
        const weatherURL =
            `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&timezone=auto`;

        const weatherResponse = await fetch(weatherURL);

        if (!weatherResponse.ok) {
            throw new Error("Could not retrieve weather data.");
        }

        const weatherData = await weatherResponse.json();

        if (!weatherData.current) {
            throw new Error("Weather data is unavailable for this city.");
        }

        // Step 3: Store data and display the result.
        latestPlace = place;
        latestWeather = weatherData;

        cityInput.value = place.name;
        renderWeather();

        weatherDiv.classList.remove("hidden");
        showMessage("");

        // Refresh the selected city's weather every five minutes.
        clearInterval(refreshInterval);
        refreshInterval = setInterval(() => {
            refreshWeather();
        }, 5 * 60 * 1000);

    } catch (error) {
        showMessage(
            error.message ||
            "Something went wrong. Please check your connection and try again.",
            true
        );
    } finally {
        searchBtn.disabled = false;
        searchBtn.textContent = "Explore ↗";
    }
}

async function refreshWeather() {
    if (!latestPlace) return;

    try {
        const { latitude, longitude } = latestPlace;

        const url =
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&timezone=auto`;

        const response = await fetch(url);

        if (!response.ok) return;

        const data = await response.json();

        if (!data.current) return;

        latestWeather = data;
        renderWeather();

    } catch (error) {
        console.error("Background weather refresh failed:", error);
    }
}

// Search using the form or Enter key.
searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    getWeather(cityInput.value);
});

// Switch between Celsius and Fahrenheit.
unitToggle.addEventListener("click", () => {
    temperatureUnit = temperatureUnit === "C" ? "F" : "C";
    renderWeather();
});

// Quick-search city buttons.
document.querySelectorAll(".city-chip").forEach((button) => {
    button.addEventListener("click", () => {
        getWeather(button.dataset.city);
    });
});

// Automatically load an example city when the website opens.
getWeather("Guwahati");

function updateWeatherScene(weatherCode, isDay) {
  const scene = document.getElementById("weather-scene");
  if (!scene) return;

  scene.classList.remove(
    "sunny", "cloudy", "rainy", "stormy", "snowy", "night"
  );

  if (!isDay) {
    scene.classList.add("night");
    return;
  }

  if (weatherCode === 0) {
    scene.classList.add("sunny");
  } else if ([1, 2, 3, 45, 48].includes(weatherCode)) {
    scene.classList.add("cloudy");
  } else if ([95, 96, 99].includes(weatherCode)) {
    scene.classList.add("stormy");
  } else if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) {
    scene.classList.add("snowy");
  } else if (
    [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(weatherCode)
  ) {
    scene.classList.add("rainy");
  } else {
    scene.classList.add("cloudy");
  }
}
