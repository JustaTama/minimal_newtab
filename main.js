import { renderCalendar } from './widgets/calendar.js';
import { renderTodo } from './widgets/todo.js';

function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('clock').textContent = `${hours}:${mins}`;
}

const weatherCodes = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Depositing rime fog", 51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
    61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
    71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow",
    80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
    95: "Thunderstorm", 96: "Thunderstorm w/ hail", 99: "Severe thunderstorm"
};

function fetchWeatherAndCity(lat, lon, tempUnit = 'celsius') {
    const now = new Date();
    const cachedWeather = localStorage.getItem('weatherData');

    if (cachedWeather) {
        const weatherData = JSON.parse(cachedWeather);
        if ((now - new Date(weatherData.timestamp)) < 30 * 60 * 1000) {
            document.getElementById('weather').textContent = weatherData.text;
            return;
        }
    }

    const tempUnitParam = tempUnit === 'fahrenheit' ? '&temperature_unit=fahrenheit' : '';

    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true${tempUnitParam}`)
        .then(res => res.json())
        .then(data => {
            const temp = Math.round(data.current_weather.temperature);
            const code = data.current_weather.weathercode;
            const desc = weatherCodes[code] || `Code ${code}`;
            let weatherText = `${desc}, ${temp}°${tempUnit === 'celsius' ? 'C' : 'F'}`;

            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`)
                .then(res => res.json())
                .then(location => {
                    const city = location.address.city || location.address.town || location.address.village || location.address.county || "your area";
                    const weatherString = `${city}: ${weatherText}`;
                    document.getElementById('weather').textContent = weatherString;

                    localStorage.setItem('weatherData', JSON.stringify({
                        text: weatherString,
                        timestamp: now.toISOString()
                    }));
                })
                .catch(() => {
                    document.getElementById('weather').textContent = weatherText;
                });
        })
        .catch(() => {
            document.getElementById('weather').textContent = "Unable to fetch weather.";
        });
}

function fetchWeatherByCity(city, tempUnit = 'celsius') {
    const now = new Date();
    const cachedWeather = localStorage.getItem('weatherData');

    if (cachedWeather) {
        const weatherData = JSON.parse(cachedWeather);
        if ((now - new Date(weatherData.timestamp)) < 30 * 60 * 1000) {
            document.getElementById('weather').textContent = weatherData.text;
            return;
        }
    }

    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}`)
        .then(res => res.json())
        .then(data => {
            if (data.length > 0) {
                const { lat, lon } = data[0];
                fetchWeatherAndCity(lat, lon, tempUnit);
            } else {
                document.getElementById('weather').textContent = "City not found";
            }
        })
        .catch(() => {
            document.getElementById('weather').textContent = "Unable to fetch weather";
        });
}

function displayPhotoCredit(photoData) {
    const creditContainer = document.getElementById('photo-credit');
    const creditLink = document.getElementById('photo-credit-link');

    if (photoData && photoData.user) {
        creditLink.href = photoData.user.links.html + "?utm_source=minimal_new_tab&utm_medium=referral";
        creditLink.textContent = photoData.user.name;
        creditContainer.style.display = 'block';
    } else {
        creditContainer.style.display = 'none';
    }
}

function analyzeAndSetTextColor(imageUrl) {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imageUrl;

    img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const x = Math.floor(img.width / 4);
        const y = Math.floor(img.height / 4);
        const width = Math.floor(img.width / 2);
        const height = Math.floor(img.height / 2);
        const imageData = ctx.getImageData(x, y, width, height).data;

        let r = 0, g = 0, b = 0;
        for (let i = 0; i < imageData.length; i += 4) {
            r += imageData[i];
            g += imageData[i + 1];
            b += imageData[i + 2];
        }
        const pixelCount = imageData.length / 4;
        const luminance = (0.299 * (r / pixelCount) + 0.587 * (g / pixelCount) + 0.114 * (b / pixelCount));
        document.body.style.color = luminance > 128 ? '#222' : '#f0f0f0';
    };
}

async function setUnsplashBackground(forceRefresh = false) {
    const now = new Date();
    const cachedData = localStorage.getItem('unsplashData');
    const userApiKey = settings.unsplashApiKey;

    let currentTheme = localStorage.getItem('theme') || 'system';
    let themeQuery = '';
    if (currentTheme === 'system') {
        currentTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    if (currentTheme === 'dark') {
        themeQuery = ',dark';
    }

    const frequencyMap = {
        '15min': 15 * 60 * 1000,
        '30min': 30 * 60 * 1000,
        'hourly': 60 * 60 * 1000,
        'daily': 24 * 60 * 60 * 1000,
        'weekly': 7 * 24 * 60 * 60 * 1000
    };
    const updateFrequency = frequencyMap[settings.unsplashUpdateFrequency] || frequencyMap['daily'];

    if (userApiKey && settings.showUnsplashRefresh) {
        document.getElementById('refresh-background').style.display = 'inline-flex';
    }

    if (cachedData && !forceRefresh) {
        const { timestamp, photo } = JSON.parse(cachedData);
        if ((now - new Date(timestamp)) < updateFrequency) {
            const img = new Image();
            img.onload = () => {
                document.body.style.backgroundImage = `url(${photo.urls.full})`;
                analyzeAndSetTextColor(photo.urls.full);
            };
            img.src = photo.urls.full;
            displayPhotoCredit(photo);
            return;
        }
    }

    if (!userApiKey) {
        console.error("Unsplash API key is missing. Please add it in the options page.");
        const creditContainer = document.getElementById('photo-credit');
        creditContainer.style.display = 'block';
        creditContainer.innerHTML = 'Unsplash background requires an API key in settings.';
        return;
    }

    try {
        let apiUrl;
        if (userApiKey) {
            const cacheBust = new Date().getTime();
            apiUrl = `https://api.unsplash.com/photos/random?query=wallpapers${themeQuery}&orientation=landscape&client_id=${userApiKey}&cache_bust=${cacheBust}`;

        }
        const response = await fetch(apiUrl);
        if (response.ok) {
            const newPhoto = await response.json();
            const img = new Image();
            img.onload = () => {
                document.body.style.backgroundImage = `url(${newPhoto.urls.full})`;
                analyzeAndSetTextColor(newPhoto.urls.full);
                localStorage.setItem('unsplashData', JSON.stringify({
                    timestamp: now.toISOString(),
                    photo: newPhoto
                }));
                displayPhotoCredit(newPhoto);
            };
            img.src = newPhoto.urls.full;
        }
        else if (response.status === 429) {
            console.warn("Unsplash background refresh rate-limited. Please wait before trying again.");
        }
    } catch (error) {
        console.error("Failed to fetch Unsplash background:", error);
    }
}

function applyTheme(theme) {
    document.body.classList.remove('dark', 'light');
    if (theme === 'dark') {
        document.body.classList.add('dark');
    } else if (theme === 'light') {
        document.body.classList.add('light');
    } else {
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.body.classList.add('dark');
        } else {
            document.body.classList.add('light');
        }
    }

    const iconContainer = document.querySelector('.theme-icon');
    const label = document.querySelector('.theme-label');
    iconContainer.innerHTML = icons[theme];
    label.textContent = theme[0].toUpperCase() + theme.slice(1);

    const customizeContainer = document.querySelector('.customize-icon');
    if (theme == 'system') {
        if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
            customizeContainer.innerHTML = customizeIcon["dark"];
        }
        else {
            customizeContainer.innerHTML = customizeIcon["light"];
        }
    }
    else {
        customizeContainer.innerHTML = customizeIcon[theme];
    }

}

function renderBookmarks(nodes, container, level = 0, path = "") {
    nodes.forEach(node => {
        const currentPath = `${path}/${node.title || "Untitled"}`;

        if (node.children && node.children.length > 0) {
            const listItem = document.createElement('li');
            listItem.className = 'bookmark-folder-item';

            const folderButton = document.createElement('button');
            folderButton.type = 'button';
            folderButton.className = 'bookmark-folder';
            const chevron = document.createElement('span');
            chevron.className = 'chevron';
            chevron.textContent = '▶';

            const title = document.createElement('span');
            title.textContent = ` ${node.title || "Untitled folder"}`;

            folderButton.appendChild(chevron);
            folderButton.appendChild(title);

            const childrenList = document.createElement('ul');
            childrenList.className = 'bookmark-children';

            const isOpen = settings.expandBookmarks ? true : localStorage.getItem(currentPath) === "true";
            if (isOpen) {
                chevron.textContent = '▼';
            } else {
                childrenList.classList.add('collapsed');
            }

            folderButton.addEventListener('click', () => {
                const isCollapsed = childrenList.classList.contains('collapsed');
                if (isCollapsed) {
                    childrenList.classList.remove('collapsed');
                    chevron.textContent = '▼';
                    localStorage.setItem(currentPath, "true");
                } else {
                    childrenList.classList.add('collapsed');
                    chevron.textContent = '▶';
                    localStorage.setItem(currentPath, "false");
                }
            });

            listItem.appendChild(folderButton);
            listItem.appendChild(childrenList);
            container.appendChild(listItem);

            renderBookmarks(node.children, childrenList, level + 1, currentPath);
        } else if (node.url) {
            const listItem = document.createElement('li');
            listItem.className = 'bookmark-link-item';

            const a = document.createElement('a');
            a.href = node.url;
            a.className = 'shortcut';
            a.textContent = node.title || node.url;

            listItem.appendChild(a);
            container.appendChild(listItem);
        }
    });
}

if (localStorage.getItem("settings") === null) {
    localStorage.setItem("settings", JSON.stringify(defaultSettings));
}

const settings = JSON.parse(localStorage.getItem("settings")) || defaultSettings;
const BROWSER = (() => {
    const ua = navigator.userAgent || '';
    if (ua.includes('Edg/')) return 'edge';
    if (ua.includes('Chrome/')) return 'chrome';
    return 'chromium';
})();

function adaptInternalUrl(url) {
    if (!url || typeof url !== 'string') return url;

    const edgeMap = {
        'chrome://bookmarks': 'edge://favorites',
        'chrome://downloads': 'edge://downloads',
        'chrome://history': 'edge://history',
        'chrome://extensions': 'edge://extensions',
        'chrome://settings': 'edge://settings',
        'chrome://password-manager/passwords': 'edge://settings/autofill/passwords',
        'chrome://password-manager': 'edge://settings/autofill/passwords'
    };

    const chromeMap = {
        'edge://favorites': 'chrome://bookmarks',
        'edge://downloads': 'chrome://downloads',
        'edge://history': 'chrome://history',
        'edge://extensions': 'chrome://extensions',
        'edge://settings': 'chrome://settings',
        'edge://settings/autofill/passwords': 'chrome://password-manager/passwords'
    };

    if (BROWSER === 'edge') {
        if (edgeMap[url]) return edgeMap[url];
        if (url.startsWith('chrome://')) return url.replace(/^chrome:\/\//, 'edge://');
        return url;
    }

    if (chromeMap[url]) return chromeMap[url];
    if (url.startsWith('edge://')) return url.replace(/^edge:\/\//, 'chrome://');
    return url;
}

function looksLikeUrl(raw) {
    const v = (raw || '').trim();
    if (!v) return false;
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(v)) return true; // scheme://
    if (v.startsWith('chrome://') || v.startsWith('edge://')) return true;
    if (v.startsWith('localhost')) return true;
    return /^[^\s]+\.[^\s]+$/.test(v) || /^[^\s]+:\d{2,5}(?:\/.*)?$/.test(v);
}

function parseIPv4Host(input) {
    const v = (input || '').trim();
    if (!v) return null;

    const noPath = v.split(/[\/?#]/)[0];

    const host = noPath.split(':')[0];
    const parts = host.split('.');
    if (parts.length !== 4) return null;

    const nums = parts.map(p => Number(p));
    if (nums.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return null;

    return nums;
}

function isIPv4(input) {
    return !!parseIPv4Host(input);
}

function normalizeUrlInput(raw) {
    const v = (raw || '').trim();
    if (!v) return '';
    if (v.startsWith('chrome://') || v.startsWith('edge://')) return adaptInternalUrl(v);

    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(v)) return v;

    if (isIPv4(v) || v.startsWith('localhost')) return `http://${v}`;

    if (looksLikeUrl(v)) return `https://${v}`;
    return v;
}

const SEARCH_ENGINES = [
    {
        id: 'google',
        name: 'Google',
        searchUrl: 'https://www.google.com/search?q={q}',
        suggestUrl: 'https://suggestqueries.google.com/complete/search?client=firefox&q={q}',
        iconSvg: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.4 0 6.5 1.2 8.9 3.2l6-6C35.3 3.1 30 1 24 1 14.7 1 6.6 6.3 2.7 13.9l7 5.4C11.7 13.1 17.4 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-2.8-.4-4.1H24v7.8h12.6c-.3 2-1.7 5-4.8 7.1l7.3 5.7c4.3-4 6.4-9.9 6.4-16.5z"/>
            <path fill="#FBBC05" d="M9.7 28.7c-.5-1.6-.8-3.2-.8-4.9s.3-3.3.8-4.9l-7-5.4C1.5 16.6.9 20.2.9 23.8s.6 7.2 1.8 10.3l7-5.4z"/>
            <path fill="#34A853" d="M24 46.6c6 0 11-2 14.7-5.4l-7.3-5.7c-2 1.4-4.7 2.4-7.4 2.4-6.6 0-12.3-4.5-14.3-10.6l-7 5.4C6.6 41.3 14.7 46.6 24 46.6z"/>
        </svg>`
    },
    {
        id: 'youtube',
        name: 'YouTube',
        searchUrl: 'https://www.youtube.com/results?search_query={q}',
        suggestUrl: 'https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q={q}',
        iconSvg: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path fill="#FF0000" d="M46.5 14.6a5.8 5.8 0 0 0-4.1-4.1C38.7 9.5 24 9.5 24 9.5s-14.7 0-18.4 1.0a5.8 5.8 0 0 0-4.1 4.1C.5 18.3.5 24 .5 24s0 5.7 1.0 9.4a5.8 5.8 0 0 0 4.1 4.1c3.7 1 18.4 1 18.4 1s14.7 0 18.4-1a5.8 5.8 0 0 0 4.1-4.1c1-3.7 1-9.4 1-9.4s0-5.7-1-9.4z"/>
            <path fill="#FFFFFF" d="M19.2 29.2V18.8L29.8 24l-10.6 5.2z"/>
        </svg>`
    },
    {
        id: 'bing',
        name: 'Bing',
        searchUrl: 'https://www.bing.com/search?q={q}',
        suggestUrl: 'https://api.bing.com/osjson.aspx?query={q}',
        iconSvg: `<img src="https://www.bing.com/sa/simg/favicon-2x.ico" alt="Bing" loading="lazy" referrerpolicy="no-referrer" />`
    },
    {
        id: 'duckduckgo',
        name: 'DuckDuckGo',
        searchUrl: 'https://duckduckgo.com/?q={q}',
        suggestUrl: 'https://duckduckgo.com/ac/?q={q}',
        iconSvg: `<img src="https://duckduckgo.com/favicon.ico" alt="DuckDuckGo" loading="lazy" referrerpolicy="no-referrer" />`
    }
];

function getEngineById(id) {
    return SEARCH_ENGINES.find(e => e.id === id) || SEARCH_ENGINES[0];
}

if (settings.customCSS) {
    const styleElement = document.createElement('style');
    styleElement.id = 'user-custom-css';
    styleElement.textContent = settings.customCSS;
    document.head.appendChild(styleElement);
}

if (settings.useUnsplash) {
    setUnsplashBackground();
} else if (settings.backgroundImage) {
    document.body.style.backgroundImage = `url(${settings.backgroundImage})`;
    analyzeAndSetTextColor(settings.backgroundImage);
}

if (settings.useUnsplash || settings.backgroundImage) {
    document.body.style.backgroundSize = "cover";
    document.body.style.backgroundPosition = "center";
}

if (settings.clock) {
    setInterval(updateClock, 1000);
    updateClock();
}
else {
    document.getElementById("clock").style.display = 'none';
}

if (settings.autoHide) {
    document.body.classList.add('auto-hide');
    document.addEventListener('mousemove', (e) => {
        const threshold = 100;
        if (window.innerHeight - e.clientY < threshold) {
            document.body.classList.add('controls-visible');
        } else {
            document.body.classList.remove('controls-visible');
        }
    });
}

if (settings.weather) {
    const useCustomCity = settings.useCustomCity;
    const tempUnit = settings.tempUnit || 'celsius';
    if (useCustomCity && settings.customCity) {
        const customCity = settings.customCity;
        fetchWeatherByCity(customCity, tempUnit);
    } else {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                pos => fetchWeatherAndCity(pos.coords.latitude, pos.coords.longitude, tempUnit),
                () => {
                    setTimeout(() => {
                        navigator.geolocation.getCurrentPosition(
                            pos => fetchWeatherAndCity(pos.coords.latitude, pos.coords.longitude, tempUnit),
                            () => document.getElementById('weather').textContent = "Location access denied."
                        );
                    }, 100);
                }
            );
        } else {
            document.getElementById('weather').textContent = "Geolocation not supported.";
        }
    }
} else {
    document.getElementById('weather').style.display = 'none';
}

if (settings.bookmarks) {
    chrome.bookmarks.getTree(tree => {
        const shortcuts = document.getElementById('shortcuts');
        let bookmarksBar = settings.bookmarkFolder?.trim()
            ? tree[0].children.find(f => f.title.toLowerCase() === settings.bookmarkFolder.toLowerCase())
            : tree[0].children[0];

        if (settings.bookmarkFolder?.trim() && !bookmarksBar) {
            shortcuts.textContent = "Bookmark folder not found.";
            return;
        }

        const listRoot = document.createElement('ul');
        listRoot.className = 'bookmark-list';
        shortcuts.innerHTML = '';

        renderBookmarks(
            settings.bookmarkFolder?.trim() ? bookmarksBar.children : tree[0].children,
            listRoot
        );

        shortcuts.appendChild(listRoot);
    });
} else {
    document.getElementById("shortcuts").style.display = 'none';
}

if (settings.topRight) {
    const topRightOrder = settings.topRightOrder;
    let container = document.getElementById("top-right");
    container.innerHTML = "";
    topRightOrder.map((item) => {
        if (item.displayBool) {
            let itemElem = document.createElement("span");
            itemElem.id = "open-" + item["id"];
            itemElem.innerHTML = item["id"];
            itemElem.addEventListener('click', () => {
                chrome.tabs.create({ url: adaptInternalUrl(item['url']) });
            })
            container.append(itemElem);
        }

    })
}
else {
    document.getElementById('top-right').style.display = 'none';
}

if (settings.sidebar) {
    const sidebar = document.getElementById('sidebar');
    sidebar.style.display = 'flex';
    sidebar.classList.add(settings.sidebarPosition || 'right');

    const sidebarContent = sidebar.querySelector('.sidebar-content');
    const selectedWidgets = settings.sidebarWidgets || [];

    const widgetRenderers = {
        calendar: renderCalendar,
        todo: renderTodo
    };

    if (selectedWidgets.length > 0) {
        selectedWidgets.forEach(widgetId => {
            if (widgetRenderers[widgetId]) {
                const widgetContainer = document.createElement('div');
                widgetContainer.classList.add('widget');
                widgetContainer.id = `widget-${widgetId}`;

                const widgetContent = widgetRenderers[widgetId];
                widgetContainer.append(widgetContent());
                sidebarContent.appendChild(widgetContainer);
            }
        });
    } else {
        sidebarContent.innerHTML = '<p style="text-align: center; margin-top: 50px;">No widgets selected. You can add widgets from the Customize menu.</p>';
    }

    if (settings.sidebarExpanded) {
        sidebar.classList.remove('minimised');
    }

    if (settings.sidebarShowCustomize || settings.sidebarExpanded) {
        const sidebarFooter = document.createElement('div');
        sidebarFooter.className = 'sidebar-footer';
        sidebarFooter.innerHTML = `<button id="sidebar-customize" class="sidebar-customize-btn" title="Customize">Customize</button>`;
        sidebar.appendChild(sidebarFooter);

        document.getElementById('sidebar-customize').addEventListener('click', () => {
            location.href = '/options.html';
        });
    }

    const customizeBtn = document.getElementById('customize');
    const themeToggle = document.querySelector('.theme-toggle');
    const updateCustomizeVisibility = () => {
        const isLeft = settings.sidebarPosition === 'left';
        const isRight = settings.sidebarPosition === 'right' || !settings.sidebarPosition;
        const isExpanded = !sidebar.classList.contains('minimised');

        if (isLeft && isExpanded) {
            customizeBtn.style.opacity = '0';
            customizeBtn.style.pointerEvents = 'none';
        } else {
            customizeBtn.style.opacity = '1';
            customizeBtn.style.pointerEvents = 'auto';
        }

        if (isRight && isExpanded) {
            themeToggle.style.opacity = '0';
            themeToggle.style.pointerEvents = 'none';
        } else {
            themeToggle.style.opacity = '1';
            themeToggle.style.pointerEvents = 'auto';
        }
    };

    updateCustomizeVisibility();

    const handle = sidebar.querySelector('.sidebar-handle');
    handle.addEventListener('click', () => {
        sidebar.classList.toggle('minimised');
        updateCustomizeVisibility();
    });
}
if (settings.unsplashApiKey && settings.showUnsplashRefresh) {
    document.getElementById('refresh-background').addEventListener('click', () => {
        setUnsplashBackground(true);
    });
}
const icons = {
    system: `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"> <defs> <linearGradient id="half"> <stop offset="50%" stop-color="white" /> <stop offset="50%" stop-color="black" /> </linearGradient> </defs> <circle cx="24" cy="24" r="10" fill="url(#half)" stroke="currentColor" stroke-width="2"/> <line x1="24" y1="2" x2="24" y2="10" stroke="currentColor" stroke-width="2"/> <line x1="24" y1="38" x2="24" y2="46" stroke="currentColor" stroke-width="2"/> <line x1="2" y1="24" x2="10" y2="24" stroke="currentColor" stroke-width="2"/> <line x1="38" y1="24" x2="46" y2="24" stroke="currentColor" stroke-width="2"/> <line x1="8.5" y1="8.5" x2="14.5" y2="14.5" stroke="currentColor" stroke-width="2"/> <line x1="33.5" y1="33.5" x2="39.5" y2="39.5" stroke="currentColor" stroke-width="2"/> <line x1="8.5" y1="39.5" x2="14.5" y2="33.5" stroke="currentColor" stroke-width="2"/> <line x1="33.5" y1="14.5" x2="39.5" y2="8.5" stroke="currentColor" stroke-width="2"/> </svg>`,
    dark: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"> <path fill="none" stroke="currentColor" d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 1 0 9.79 9.79Z"/> </svg>`,
    light: `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"> <circle cx="24" cy="24" r="10" fill="none"/> <line x1="24" y1="2" x2="24" y2="10"/> <line x1="24" y1="38" x2="24" y2="46"/> <line x1="2" y1="24" x2="10" y2="24"/> <line x1="38" y1="24" x2="46" y2="24"/> <line x1="8.5" y1="8.5" x2="14.5" y2="14.5"/> <line x1="33.5" y1="33.5" x2="39.5" y2="39.5"/> <line x1="8.5" y1="39.5" x2="14.5" y2="33.5"/> <line x1="33.5" y1="14.5" x2="39.5" y2="8.5"/> </svg>`
};

const customizeIcon = {
    "dark": `<svg fill="currentColor" width="32px" height="32px" viewBox="-1 0 44 44"><path id="_45.Settings" data-name="45.Settings" d="M35,22H13A10,10,0,0,1,13,2H35a10,10,0,0,1,0,20ZM35,4H13a8,8,0,0,0,0,16H35A8,8,0,0,0,35,4ZM13,18a6,6,0,1,1,6-6A6,6,0,0,1,13,18ZM13,8a4,4,0,1,0,4,4A4,4,0,0,0,13,8Zm0,18H35a10,10,0,0,1,0,20H13a10,10,0,0,1,0-20Zm0,18H35a8,8,0,0,0,0-16H13a8,8,0,0,0,0,16ZM35,30a6,6,0,1,1-6,6A6,6,0,0,1,35,30Zm0,10a4,4,0,1,0-4-4A4,4,0,0,0,35,40Z" transform="translate(-3 -2)" fill-rule="evenodd"/></svg>`,
    "light": `<svg fill="currentColor" width="32px" height="32px" viewBox="-1 0 44 44"><path id="_45.Settings" data-name="45.Settings" d="M35,22H13A10,10,0,0,1,13,2H35a10,10,0,0,1,0,20ZM35,4H13a8,8,0,0,0,0,16H35A8,8,0,0,0,35,4ZM13,18a6,6,0,1,1,6-6A6,6,0,0,1,13,18ZM13,8a4,4,0,1,0,4,4A4,4,0,0,0,13,8Zm0,18H35a10,10,0,0,1,0,20H13a10,10,0,0,1,0-20Zm0,18H35a8,8,0,0,0,0-16H13a8,8,0,0,0,0,16ZM35,30a6,6,0,1,1-6,6A6,6,0,0,1,35,30Zm0,10a4,4,0,1,0-4-4A4,4,0,0,0,35,40Z" transform="translate(-3 -2)" fill-rule="evenodd"/></svg>`
}

document.getElementById("customize").addEventListener("click", () => {
    location.href = "/options.html";
})

let theme = localStorage.getItem('theme') || 'system';
applyTheme(theme);

document.querySelector('.theme-toggle').addEventListener('click', () => {
    if (theme === 'system') {
        theme = 'dark';
    } else if (theme === 'dark') {
        theme = 'light';
    } else {
        theme = 'system';
    }

    localStorage.setItem('theme', theme);
    applyTheme(theme);
});

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (theme === 'system') {
        applyTheme('system');
    }
});

(function initSearch() {
    const container = document.getElementById('search-container');
    const input = document.getElementById('search-input');
    const picker = document.getElementById('engine-picker');
    const icon = document.getElementById('engine-icon');
    const name = document.getElementById('engine-name');
    const suggestionsBox = document.getElementById('suggestions');

    if (!container || !input || !picker || !icon || !name || !suggestionsBox) return;

    const MAX_SUGGESTIONS = 7; // includes the "typed text" row
    const stored = localStorage.getItem('searchEngine') || 'google';
    let current = getEngineById(stored);

    let suggestionItems = [];
    let activeIndex = 0;
    let lastQuery = '';
    let fetchSeq = 0;

    function renderEngine() {
        icon.innerHTML = current.iconSvg;
        name.textContent = current.name;
    }
    renderEngine();

    const engineMenu = document.createElement('div');
    engineMenu.className = 'suggestions engine-menu';
    engineMenu.id = 'engine-menu';
    engineMenu.hidden = true;
    engineMenu.setAttribute('role', 'listbox');

    SEARCH_ENGINES.forEach((eng) => {
        const row = document.createElement('div');
        row.className = 'suggestion-item';
        row.setAttribute('role', 'option');
        row.dataset.engineId = eng.id;
        row.innerHTML = `<span style="display:inline-flex;align-items:center;gap:0.55rem;">
            <span class="engine-icon" aria-hidden="true">${eng.iconSvg}</span>
            <span>${eng.name}</span>
        </span>`;
        row.addEventListener('click', () => {
            current = eng;
            localStorage.setItem('searchEngine', eng.id);
            renderEngine();
            closeEngineMenu();
            clearSuggestions();
            input.focus();
            updateSuggestions();
        });
        engineMenu.appendChild(row);
    });

    picker.after(engineMenu);

    function openEngineMenu() {
        picker.setAttribute('aria-expanded', 'true');
        engineMenu.hidden = false;
        const rect = picker.getBoundingClientRect();
        engineMenu.style.position = 'fixed';
        engineMenu.style.left = `${rect.left}px`;
        engineMenu.style.top = `${rect.bottom + 8}px`;
        engineMenu.style.width = `${Math.min(280, Math.max(200, rect.width))}px`;
        engineMenu.style.maxHeight = '220px';
        engineMenu.style.overflowY = 'auto';
    }

    function closeEngineMenu() {
        picker.setAttribute('aria-expanded', 'false');
        engineMenu.hidden = true;
    }

    picker.addEventListener('click', (e) => {
        e.stopPropagation();
        if (engineMenu.hidden) openEngineMenu();
        else closeEngineMenu();
    });

    document.addEventListener('click', () => closeEngineMenu());

    picker.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (engineMenu.hidden) openEngineMenu(); else closeEngineMenu();
        }
        if (e.key === 'Escape') closeEngineMenu();
    });

    function escapeHtml(s) {
        return (s || '').replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    function highlightMatch(text, query) {
        const t = escapeHtml(text);
        const q = (query || '').trim();
        if (!q) return t;

        const i = text.toLowerCase().indexOf(q.toLowerCase());
        if (i < 0) return t;

        const before = escapeHtml(text.slice(0, i));
        const mid = escapeHtml(text.slice(i, i + q.length));
        const after = escapeHtml(text.slice(i + q.length));
        return `${before}<mark>${mid}</mark>${after}`;
    }

    function setActive(idx) {
        activeIndex = Math.max(0, Math.min(idx, suggestionItems.length - 1));
        const rows = suggestionsBox.querySelectorAll('.suggestion-item');
        rows.forEach((el, i) => el.classList.toggle('active', i === activeIndex));
    }

    function showSuggestions() {
        if (suggestionItems.length <= 1) {
            suggestionsBox.hidden = true;
            return;
        }
        suggestionsBox.hidden = false;
        setActive(activeIndex);
    }

    function clearSuggestions() {
        suggestionItems = [];
        suggestionsBox.innerHTML = '';
        suggestionsBox.hidden = true;
        activeIndex = 0;
    }

    async function fetchSuggestions(q) {
        const url = current.suggestUrl.replace('{q}', encodeURIComponent(q));
        const res = await fetch(url, { method: 'GET' });
        if (!res.ok) return [];

        if (current.id === 'google' || current.id === 'youtube' || current.id === 'bing') {
            const data = await res.json();
            const arr = Array.isArray(data) ? data[1] : [];
            return Array.isArray(arr) ? arr.filter(Boolean) : [];
        }

        if (current.id === 'duckduckgo') {
            const data = await res.json();
            if (!Array.isArray(data)) return [];
            return data.map(x => x && (x.phrase || x)).filter(Boolean);
        }

        return [];
    }

    async function updateSuggestions() {
        const q = (input.value || '').trim();
        lastQuery = q;

        if (!q) {
            clearSuggestions();
            return;
        }

        const seq = ++fetchSeq;
        let sugg = [];
        try {
            sugg = await fetchSuggestions(q);
        } catch (e) {
            sugg = [];
        }
        if (seq !== fetchSeq) return; // stale

        const unique = new Set();
        const list = [q];
        unique.add(q.toLowerCase());

        for (const s of sugg) {
            const raw = String(s ?? '').trim();
            if (!raw) continue;

            const parts = (current.id === 'duckduckgo' && raw.includes(',') && (raw.match(/,/g) || []).length >= 2)
                ? raw.split(',').map(x => x.trim()).filter(Boolean)
                : [raw];

            for (const clean of parts) {
                const key = clean.toLowerCase();
                if (unique.has(key)) continue;
                unique.add(key);
                list.push(clean);
                if (list.length >= MAX_SUGGESTIONS) break;
            }
            if (list.length >= MAX_SUGGESTIONS) break;
        }

        suggestionItems = list;

        suggestionsBox.innerHTML = '';
        list.forEach((text, idx) => {
            const row = document.createElement('div');
            row.className = 'suggestion-item';
            row.setAttribute('role', 'option');
            row.dataset.index = String(idx);
            row.innerHTML = highlightMatch(text, q);
            row.addEventListener('mousedown', (e) => {
                e.preventDefault();
            });
            row.addEventListener('click', () => {
                input.value = text;
                doSearch(text);
            });
            suggestionsBox.appendChild(row);
        });

        activeIndex = 0; // default to typed row
        showSuggestions();
    }

    async function navigateInPlace(url) {
        try {
            chrome.tabs.getCurrent((tab) => {
                try {
                    if (tab && typeof tab.id === 'number') {
                        chrome.tabs.update(tab.id, { url });
                    } else {
                        chrome.tabs.update({ url });
                    }
                } catch (_) {
                    try { window.location.href = url; } catch (__) { /* ignore */ }
                }
            });
        } catch (_) {
            try { window.location.href = url; } catch (__) { /* ignore */ }
        }
    }

    function doSearch(queryRaw) {
        const q = (queryRaw || '').trim();
        if (!q) return;

        if (looksLikeUrl(q) || q.startsWith('chrome://') || q.startsWith('edge://') || isIPv4(q)) {
            const url = normalizeUrlInput(q);
            navigateInPlace(url);
            return;
        }

        const url = current.searchUrl.replace('{q}', encodeURIComponent(q));
        navigateInPlace(url);
    }

    function moveSelection(delta) {
        if (suggestionItems.length === 0) return;
        const next = (activeIndex + delta + suggestionItems.length) % suggestionItems.length;
        setActive(next);
    }

    function acceptActive() {
        if (!suggestionItems.length) return (input.value || '');
        return suggestionItems[activeIndex] || (input.value || '');
    }

    const debouncedUpdate = (() => {
        let t = null;
        return () => {
            if (t) clearTimeout(t);
            t = setTimeout(updateSuggestions, 120);
        };
    })();

    let pendingEnter = false;
    let pendingEnterChosen = null;

    input.addEventListener('input', () => {
        debouncedUpdate();
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
            if (!suggestionsBox.hidden) {
                e.preventDefault();
                moveSelection(1);
            }
            return;
        }
        if (e.key === 'ArrowUp') {
            if (!suggestionsBox.hidden) {
                e.preventDefault();
                moveSelection(-1);
            }
            return;
        }
        if (e.key === 'Tab') {
            if (!suggestionsBox.hidden) {
                e.preventDefault();
                moveSelection(e.shiftKey ? -1 : 1);
            }
            return;
        }
        if (e.key === 'Escape') {
            clearSuggestions();
            return;
        }
        if (e.key === 'Enter') {
            if (e.isComposing) return;
            e.preventDefault();

            const hasSuggestions = !suggestionsBox.hidden && suggestionItems.length > 0;
            const isTypedRow = !hasSuggestions || activeIndex === 0;

            pendingEnter = true;
            pendingEnterChosen = null;

            if (!isTypedRow) {
                const chosen = acceptActive();
                pendingEnterChosen = chosen;
                input.value = chosen;
            }
            return;
        }
    });

    input.addEventListener('keyup', (e) => {
        if (e.key !== 'Enter') return;
        if (!pendingEnter) return;
        pendingEnter = false;

        const q = ((pendingEnterChosen ?? input.value) || '').trim();
        pendingEnterChosen = null;
        if (!q) return;

        input.value = q;
        doSearch(q);
    });

    input.addEventListener('focus', () => {
        if ((input.value || '').trim()) updateSuggestions();
    });

    input.addEventListener('blur', () => {
        setTimeout(() => clearSuggestions(), 120);
    });

    setTimeout(() => {
        try { input.focus(); } catch (e) { /* ignore */ }
    }, 60);
})();
