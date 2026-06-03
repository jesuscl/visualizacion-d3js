// ============================================================
// DIMENSIONES COMUNES
// ============================================================
const margin = { top: 40, right: 30, bottom: 60, left: 80 };
const marginCorr = { top: 100, right: 30, bottom: 80, left: 150 };
let fullData = [];
let continentsData = [];
let correlationData = {};

// Colores para continentes
const continentColors = {
    'Africa': '#e41a1c',
    'Asia': '#377eb8',
    'Europe': '#4daf4a',
    'North America': '#984ea3',
    'Oceania': '#ff7f00',
    'South America': '#f781bf'
};

// Escala de color para Gini
const giniColorScale = d3.scaleLinear()
    .domain([25, 45, 65])
    .range(['#1b7837', '#ffffbf', '#d73027'])
    .interpolate(d3.interpolateRgb.gamma(2.2));

// Escala para tamaño de burbuja (CO₂)
let sizeScale = d3.scaleSqrt().domain([0, 20]).range([4, 30]);

// Escala de color para correlaciones
const corrColorScale = d3.scaleLinear()
    .domain([-1, -0.5, 0, 0.5, 1])
    .range(['#d73027', '#f46d43', '#fdae61', '#ffffbf', '#abd9e9', '#74add1', '#4575b4']);

// Variables para la matriz de correlación
const corrVariables = ['ahdi', 'life_exp', 'schooling', 'democracy', 'gdp', 'gini', 'co2_per_capita'];
const varLabels = {
    'ahdi': 'AHDI',
    'life_exp': 'Esperanza de vida',
    'schooling': 'Educación',
    'democracy': 'Democracia',
    'gdp': 'PIB per cápita',
    'gini': 'Desigualdad (Gini)',
    'co2_per_capita': 'CO₂ per cápita'
};

// ============================================================
// CARGA DE DATOS
// ============================================================
Promise.all([
    d3.csv("data/ahdi_gini_co2_dataset.csv"),
    d3.csv("data/correlation_matrices.csv")
]).then(function([mainData, corrData]) {
    fullData = mainData;
    
    // Procesar datos para gráfico de líneas
    const continentsMap = new Map();
    mainData.forEach(d => {
        const year = +d.year;
        const continent = d.continent;
        const ahdi = +d.ahdi;
        if (!continent) return;
        if (!continentsMap.has(continent)) continentsMap.set(continent, new Map());
        const yearMap = continentsMap.get(continent);
        if (!yearMap.has(year)) yearMap.set(year, { sum: 0, count: 0 });
        const stat = yearMap.get(year);
        stat.sum += ahdi;
        stat.count++;
    });
    
    continentsData = [];
    for (let [continent, yearMap] of continentsMap.entries()) {
        for (let [year, stat] of yearMap.entries()) {
            continentsData.push({
                continent: continent,
                year: +year,
                avg_ahdi: stat.sum / stat.count
            });
        }
    }
    
    // Procesar datos de correlación
    corrData.forEach(d => {
        const year = +d.year;
        if (!correlationData[year]) correlationData[year] = [];
        correlationData[year].push({
            row_variable: d.row_variable,
            col_variable: d.col_variable,
            correlation: +d.correlation
        });
    });
    
    // Dibujar todos los gráficos
    drawLineChart();
    drawMap(2010);
    drawBubbleChart(2010);
    drawCorrelationMatrix(2010);
    
    // Configurar eventos
    const slider = document.getElementById("year-slider");
    const yearDisplay = document.getElementById("year-value");
    const playButton = document.getElementById("play-button");
    let intervalId = null;
    
    function updateYear(year) {
        yearDisplay.innerText = year;
        drawBubbleChart(year);
        drawMap(year);  // actualizar mapa
    }
    
    slider.addEventListener("input", function() {
        if (intervalId) clearInterval(intervalId);
        updateYear(+this.value);
    });
    
    playButton.addEventListener("click", function() {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
            playButton.textContent = "▶ Play";
        } else {
            let currentYear = +slider.value;
            intervalId = setInterval(() => {
                let nextYear = currentYear + 5;
                if (nextYear > 2020) nextYear = 1990;
                slider.value = nextYear;
                updateYear(nextYear);
                currentYear = nextYear;
            }, 1500);
            playButton.textContent = "⏸ Pause";
        }
    });
    
    d3.select("#corr-year-select").on("change", function() {
        drawCorrelationMatrix(+this.value);
    });
});

// ============================================================
// ACTO I: GRÁFICO DE LÍNEAS (CORREGIDO)
// ============================================================
function drawLineChart() {
    const container = document.getElementById("line-chart-container");
    const width = container.clientWidth;
    const height = 450;
    
    d3.select("#line-chart-container").selectAll("*").remove();
    
    const svg = d3.select("#line-chart-container")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    const xScale = d3.scaleLinear()
        .domain([1990, 2020])
        .range([0, innerWidth]);
    
    const yScale = d3.scaleLinear()
        .domain([0.1, 0.9])
        .range([innerHeight, 0]);
    
    // Ejes
    svg.append("g")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale).tickFormat(d3.format("d")).tickValues([1990, 1995, 2000, 2005, 2010, 2015, 2020]));
    
    svg.append("g")
        .call(d3.axisLeft(yScale));
    
    // ETIQUETA DEL EJE Y - A LA IZQUIERDA (CORREGIDO)
    svg.append("text")
        .attr("x", -45)
        .attr("y", 15)
        .attr("text-anchor", "middle")
        .attr("transform", "rotate(-90)")
        .style("fill", "#5d6d7e")
        .style("font-size", "12px")
        .text("AHDI promedio");
    
    // ETIQUETA DEL EJE X - DEBAJO
    svg.append("text")
        .attr("x", innerWidth / 2)
        .attr("y", innerHeight + 35)
        .attr("text-anchor", "middle")
        .style("fill", "#5d6d7e")
        .style("font-size", "12px")
        .text("Año");
    
    const continents = [...new Set(continentsData.map(d => d.continent))];
    const lineGen = d3.line()
        .x(d => xScale(d.year))
        .y(d => yScale(d.avg_ahdi))
        .curve(d3.curveCatmullRom);
    
    continents.forEach(continent => {
        const points = continentsData.filter(d => d.continent === continent).sort((a,b) => a.year - b.year);
        
        svg.append("path")
            .datum(points)
            .attr("fill", "none")
            .attr("stroke", continentColors[continent] || "#999")
            .attr("stroke-width", 2.5)
            .attr("d", lineGen);
        
        svg.selectAll(`.dot-${continent.replace(/\s/g, '')}`)
            .data(points)
            .enter()
            .append("circle")
            .attr("cx", d => xScale(d.year))
            .attr("cy", d => yScale(d.avg_ahdi))
            .attr("r", 4)
            .attr("fill", continentColors[continent] || "#999")
            .attr("stroke", "white")
            .attr("stroke-width", 1);
    });
    
    // Leyenda en el contenedor HTML (no dentro del SVG)
    const legendContainer = d3.select("#line-legend");
    legendContainer.html("");
    
    continents.forEach(continent => {
        const item = legendContainer.append("div").attr("class", "line-legend-item");
        item.append("div")
            .attr("class", "line-legend-color")
            .style("background", continentColors[continent] || "#999");
        item.append("span").text(continent).style("font-size", "12px");
    });
}

// ============================================================
// ACTO II - MAPA COROPLÉTICO (con tooltip mejorado)
// ============================================================

let worldMap = null;
let mapData = null;

// Escala de color para el mapa (AHDI)
const mapColorScale = d3.scaleLinear()
    .domain([0.1, 0.3, 0.5, 0.7, 0.9])
    .range(['#d73027', '#f46d43', '#fdae61', '#abd9e9', '#4575b4']);

function drawMap(year) {
    const container = document.getElementById("map-container");
    const width = container.clientWidth;
    const height = 500;
    
    // Limpiar contenedor
    d3.select("#map-container").selectAll("*").remove();
    
    // Crear SVG
    const svg = d3.select("#map-container")
        .append("svg")
        .attr("width", width)
        .attr("height", height);
    
    // Proyección geográfica (mercator centrada)
    const projection = d3.geoMercator()
        .scale(width / 6.5)
        .translate([width / 2, height / 1.8]);
    
    const path = d3.geoPath().projection(projection);
    
    // Filtrar datos para el año seleccionado y crear mapa de datos por país
    const yearData = fullData.filter(d => +d.year === year);
    const countryDataMap = new Map();
    yearData.forEach(d => {
        countryDataMap.set(d.country, {
            ahdi: +d.ahdi,
            gini: +d.gini,
            co2: +d.co2_per_capita,
            continent: d.continent
        });
    });
    
    // Tooltip para el mapa
    let mapTooltip = d3.select(".map-tooltip");
    if (mapTooltip.empty()) {
        mapTooltip = d3.select("body").append("div").attr("class", "map-tooltip").style("opacity", 0);
    }
    
    // Función para normalizar nombres de países (corregir diferencias entre datasets)
    function normalizeCountryName(topojsonName, ourName) {
        // Mapeo manual de nombres que no coinciden
        const nameMapping = {
            'United States': 'United States',
            'United Kingdom': 'United Kingdom',
            'Russia': 'Russia',
            'Brazil': 'Brazil',
            'Canada': 'Canada',
            'Australia': 'Australia',
            'China': 'China',
            'India': 'India',
            'South Africa': 'South Africa',
            'Mexico': 'Mexico',
            'Argentina': 'Argentina',
            'Chile': 'Chile',
            'Peru': 'Peru',
            'Colombia': 'Colombia',
            'Venezuela': 'Venezuela',
            'Egypt': 'Egypt',
            'Nigeria': 'Nigeria',
            'Kenya': 'Kenya',
            'Ethiopia': 'Ethiopia',
            'Turkey': 'Turkey',
            'Iran': 'Iran',
            'Pakistan': 'Pakistan',
            'Indonesia': 'Indonesia',
            'Thailand': 'Thailand',
            'Vietnam': 'Vietnam',
            'Malaysia': 'Malaysia',
            'Philippines': 'Philippines',
            'France': 'France',
            'Germany': 'Germany',
            'Spain': 'Spain',
            'Italy': 'Italy',
            'Portugal': 'Portugal',
            'Netherlands': 'Netherlands',
            'Belgium': 'Belgium',
            'Sweden': 'Sweden',
            'Norway': 'Norway',
            'Denmark': 'Denmark',
            'Finland': 'Finland',
            'Switzerland': 'Switzerland',
            'Austria': 'Austria',
            'Poland': 'Poland',
            'Ukraine': 'Ukraine',
            'Romania': 'Romania',
            'Greece': 'Greece',
            'Ireland': 'Ireland',
            'New Zealand': 'New Zealand',
            'Japan': 'Japan',
            'South Korea': 'South Korea',
            'Israel': 'Israel'
        };
        
        // Verificar si hay mapeo directo
        if (nameMapping[topojsonName] === ourName) return true;
        if (topojsonName === ourName) return true;
        
        // Verificar si el nombre del TopoJSON contiene el nombre del dataset o viceversa
        if (topojsonName.includes(ourName) || ourName.includes(topojsonName)) return true;
        
        return false;
    }
    
    // Cargar y dibujar el mapa
    d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json").then(function(world) {
        const countries = topojson.feature(world, world.objects.countries);
        
        svg.selectAll(".country")
            .data(countries.features)
            .enter()
            .append("path")
            .attr("class", "country")
            .attr("d", path)
            .attr("fill", d => {
                const countryName = d.properties.name;
                let matchedData = null;
                
                for (let [name, data] of countryDataMap.entries()) {
                    if (normalizeCountryName(countryName, name)) {
                        matchedData = data;
                        break;
                    }
                }
                
                if (matchedData && !isNaN(matchedData.ahdi)) {
                    return mapColorScale(matchedData.ahdi);
                }
                return "#cccccc"; // Sin datos
            })
            .attr("stroke", "#333")
            .attr("stroke-width", 0.5)
            .on("mouseover", function(event, d) {
                d3.select(this).attr("stroke-width", 1.5);
                
                const countryName = d.properties.name;
                let matchedCountry = null;
                let matchedData = null;
                
                for (let [name, data] of countryDataMap.entries()) {
                    if (normalizeCountryName(countryName, name)) {
                        matchedCountry = name;
                        matchedData = data;
                        break;
                    }
                }
                
                // Formatear valores para mostrar
                const ahdiValue = matchedData ? matchedData.ahdi.toFixed(3) : "Sin datos";
                const giniValue = matchedData && !isNaN(matchedData.gini) ? matchedData.gini.toFixed(1) : "Sin datos";
                const co2Value = matchedData && !isNaN(matchedData.co2) ? matchedData.co2.toFixed(2) : "Sin datos";
                const continentValue = matchedData ? matchedData.continent : "Desconocido";
                
                mapTooltip.transition().duration(200).style("opacity", 0.9);
                mapTooltip.html(`
                    <strong>${countryName}</strong><br/>
                    <hr style="margin: 4px 0; border-color: #555;">
                    🟢 <strong>AHDI:</strong> ${ahdiValue}<br/>
                    🟡 <strong>Índice Gini:</strong> ${giniValue}<br/>
                    ⚫ <strong>CO₂ per cápita:</strong> ${co2Value} t<br/>
                    🌍 <strong>Continente:</strong> ${continentValue}<br/>
                    📅 <strong>Año:</strong> ${year}
                `)
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 30) + "px");
            })
            .on("mouseout", function() {
                d3.select(this).attr("stroke-width", 0.5);
                mapTooltip.transition().duration(500).style("opacity", 0);
            })
            .on("click", function(event, d) {
                const countryName = d.properties.name;
                let matchedCountry = null;
                
                for (let name of countryDataMap.keys()) {
                    if (normalizeCountryName(countryName, name)) {
                        matchedCountry = name;
                        break;
                    }
                }
                
                if (matchedCountry) {
                    updateDetailChart(matchedCountry);
                    d3.select("#detail-section").style("display", "block");
                    d3.select("#selected-country-name").text(matchedCountry);
                    document.getElementById("detail-section").scrollIntoView({ behavior: "smooth" });
                } else {
                    // Mostrar mensaje si no hay datos
                    mapTooltip.transition().duration(200).style("opacity", 0.9);
                    mapTooltip.html(`<strong>${countryName}</strong><br/>No hay datos disponibles para este país en ${year}`)
                        .style("left", (event.pageX + 15) + "px")
                        .style("top", (event.pageY - 30) + "px");
                    setTimeout(() => {
                        mapTooltip.transition().duration(500).style("opacity", 0);
                    }, 1500);
                }
            });
            
    }).catch(error => {
        console.error("Error cargando el mapa:", error);
        d3.select("#map-container").html('<div style="text-align:center; padding:50px;">❌ No se pudo cargar el mapa. Verifica tu conexión a internet.</div>');
    });
    
    // Actualizar leyenda del mapa
    const legendContainer = d3.select("#map-legend");
    legendContainer.html("");
    
    legendContainer.append("div").attr("class", "map-legend-item")
        .html('<span style="font-size:12px;">🔴 Bajo AHDI →</span>')
        .append("div").attr("class", "map-legend-gradient");
    legendContainer.append("div").attr("class", "map-legend-item")
        .html('<span style="font-size:12px;">← Alto AHDI 🔵</span>');
    
    // Añadir nota de interacción
    legendContainer.append("div").attr("class", "map-legend-item")
        .html('<span style="font-size:11px; color:#7f8c8d;">💡 Pasa el ratón sobre un país para ver sus valores</span>');
}

// ============================================================
// ACTO II: GRÁFICO DE BURBUJAS (CORREGIDO - etiquetas)
// ============================================================
function drawBubbleChart(year) {
    const container = document.getElementById("bubble-chart-container");
    const width = container.clientWidth;
    const height = 500;
    
    d3.select("#bubble-chart-container").selectAll("*").remove();
    
    const svg = d3.select("#bubble-chart-container")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    const yearData = fullData.filter(d => +d.year === year);
    const maxCo2 = d3.max(yearData, d => +d.co2_per_capita) || 10;
    sizeScale.domain([0, Math.max(10, maxCo2)]).range([4, 40]);
    
    const xScale = d3.scaleLinear()
        .domain([1990, 2020])
        .range([0, innerWidth]);
    
    const yScale = d3.scaleLinear()
        .domain([0.1, 0.95])
        .range([innerHeight, 0]);
    
    // Ejes
    svg.append("g")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale).tickFormat(d3.format("d")).tickValues([1990, 1995, 2000, 2005, 2010, 2015, 2020]));
    
    svg.append("g")
        .call(d3.axisLeft(yScale));
    
    // ETIQUETA DEL EJE Y - A LA IZQUIERDA (CORREGIDO)
    svg.append("text")
        .attr("x", -45)
        .attr("y", 15)
        .attr("text-anchor", "middle")
        .attr("transform", "rotate(-90)")
        .style("fill", "#5d6d7e")
        .style("font-size", "12px")
        .text("AHDI");
    
    // ETIQUETA DEL EJE X - DEBAJO
    svg.append("text")
        .attr("x", innerWidth / 2)
        .attr("y", innerHeight + 35)
        .attr("text-anchor", "middle")
        .style("fill", "#5d6d7e")
        .style("font-size", "12px")
        .text("Año");
    
    let tooltip = d3.select(".tooltip");
    if (tooltip.empty()) {
        tooltip = d3.select("body").append("div").attr("class", "tooltip").style("opacity", 0);
    }
    
    yearData.forEach(d => {
        const gini = +d.gini;
        const co2 = +d.co2_per_capita;
        const ahdi = +d.ahdi;
        const country = d.country;
        let fillColor = "#cccccc";
        if (!isNaN(gini) && gini > 0) fillColor = giniColorScale(gini);
        
        svg.append("circle")
            .attr("class", "bubble")
            .attr("cx", xScale(year))
            .attr("cy", yScale(ahdi))
            .attr("r", sizeScale(co2))
            .attr("fill", fillColor)
            .attr("stroke", "#333")
            .attr("stroke-width", 0.8)
            .attr("data-country", country)
            .on("mouseover", function(event) {
                d3.select(this).attr("stroke-width", 2.5);
                tooltip.transition().duration(200).style("opacity", 0.9);
                tooltip.html(`<strong>${country}</strong><br/>AHDI: ${ahdi.toFixed(3)}<br/>Gini: ${gini.toFixed(1)}<br/>CO₂: ${co2.toFixed(2)} t`)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function() {
                d3.select(this).attr("stroke-width", 0.8);
                tooltip.transition().duration(500).style("opacity", 0);
            })
            .on("click", function() {
                updateDetailChart(country);
                d3.select("#detail-section").style("display", "block");
                d3.select("#selected-country-name").text(country);
                document.getElementById("detail-section").scrollIntoView({ behavior: "smooth" });
            });
    });
}

// ============================================================
// ACTO III: GRÁFICO DE DETALLE (CORREGIDO)
// ============================================================
function updateDetailChart(countryName) {
    const countryData = fullData.filter(d => d.country === countryName).sort((a,b) => +a.year - +b.year);
    if (countryData.length === 0) return;
    
    const container = document.getElementById("detail-chart-container");
    const width = container.clientWidth;
    const height = 380;
    
    d3.select("#detail-chart-container").selectAll("*").remove();
    
    const svg = d3.select("#detail-chart-container")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    const xScale = d3.scaleLinear()
        .domain([1990, 2020])
        .range([0, innerWidth]);
    
    const yScaleLeft = d3.scaleLinear()
        .domain([0.1, 0.95])
        .range([innerHeight, 0]);
    
    const maxGini = d3.max(countryData, d => +d.gini) || 60;
    const maxCo2 = d3.max(countryData, d => +d.co2_per_capita) || 20;
    const yScaleRight = d3.scaleLinear()
        .domain([0, Math.max(maxGini, maxCo2 * 2)])
        .range([innerHeight, 0]);
    
    // Ejes
    svg.append("g")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale).tickFormat(d3.format("d")).tickValues([1990, 1995, 2000, 2005, 2010, 2015, 2020]));
    
    svg.append("g")
        .call(d3.axisLeft(yScaleLeft));
    
    svg.append("g")
        .attr("transform", `translate(${innerWidth}, 0)`)
        .call(d3.axisRight(yScaleRight));
    
    // Líneas
    const lineAHDI = d3.line()
        .x(d => xScale(+d.year))
        .y(d => yScaleLeft(+d.ahdi))
        .curve(d3.curveCatmullRom);
    
    const lineGini = d3.line()
        .x(d => xScale(+d.year))
        .y(d => yScaleRight(+d.gini))
        .curve(d3.curveCatmullRom);
    
    const lineCO2 = d3.line()
        .x(d => xScale(+d.year))
        .y(d => yScaleRight(+d.co2_per_capita))
        .curve(d3.curveCatmullRom);
    
    svg.append("path")
        .datum(countryData)
        .attr("fill", "none")
        .attr("stroke", "#2980b9")
        .attr("stroke-width", 2.5)
        .attr("d", lineAHDI);
    
    svg.append("path")
        .datum(countryData)
        .attr("fill", "none")
        .attr("stroke", "#d73027")
        .attr("stroke-width", 2.5)
        .attr("d", lineGini);
    
    svg.append("path")
        .datum(countryData)
        .attr("fill", "none")
        .attr("stroke", "#2c3e50")
        .attr("stroke-width", 2.5)
        .attr("stroke-dasharray", "5,5")
        .attr("d", lineCO2);
    
    // Puntos
    countryData.forEach(d => {
        svg.append("circle")
            .attr("cx", xScale(+d.year))
            .attr("cy", yScaleLeft(+d.ahdi))
            .attr("r", 4)
            .attr("fill", "#2980b9");
        
        svg.append("circle")
            .attr("cx", xScale(+d.year))
            .attr("cy", yScaleRight(+d.gini))
            .attr("r", 4)
            .attr("fill", "#d73027");
        
        svg.append("circle")
            .attr("cx", xScale(+d.year))
            .attr("cy", yScaleRight(+d.co2_per_capita))
            .attr("r", 4)
            .attr("fill", "#2c3e50");
    });
    
    // Leyenda en el contenedor HTML (CORREGIDO)
    const legendContainer = d3.select("#detail-legend");
    legendContainer.html("");
    
    const item1 = legendContainer.append("div").attr("class", "detail-legend-item");
    item1.append("div").attr("class", "detail-legend-line").style("background", "#2980b9");
    item1.append("span").text("AHDI").style("font-size", "12px");
    
    const item2 = legendContainer.append("div").attr("class", "detail-legend-item");
    item2.append("div").attr("class", "detail-legend-line").style("background", "#d73027");
    item2.append("span").text("Índice Gini").style("font-size", "12px");
    
    const item3 = legendContainer.append("div").attr("class", "detail-legend-item");
    item3.append("div").attr("class", "detail-legend-line-dashed");
    item3.append("span").text("CO₂ per cápita").style("font-size", "12px");
}

// ============================================================
// ACTO IV: MATRIZ DE CORRELACIÓN (SIN CAMBIOS - YA FUNCIONA)
// ============================================================
function drawCorrelationMatrix(year) {
    const container = document.getElementById("correlation-container");
    const width = container.clientWidth;
    const height = 600;
    
    d3.select("#correlation-container").selectAll("*").remove();
    
    const yearData = correlationData[year];
    if (!yearData) return;
    
    const matrixSize = corrVariables.length;
    const cellSize = Math.min((width - marginCorr.left - marginCorr.right) / matrixSize, 65);
    const innerWidth = cellSize * matrixSize;
    const innerHeight = cellSize * matrixSize;
    
    const svg = d3.select("#correlation-container")
        .append("svg")
        .attr("width", innerWidth + marginCorr.left + marginCorr.right + 20)
        .attr("height", innerHeight + marginCorr.top + marginCorr.bottom + 20)
        .append("g")
        .attr("transform", `translate(${marginCorr.left},${marginCorr.top})`);
    
    // Crear matriz
    const corrMatrix = {};
    corrVariables.forEach(rowVar => {
        corrMatrix[rowVar] = {};
        corrVariables.forEach(colVar => {
            const match = yearData.find(d => d.row_variable === rowVar && d.col_variable === colVar);
            corrMatrix[rowVar][colVar] = match ? match.correlation : 0;
        });
    });
    
    const xScale = d3.scaleBand()
        .domain(corrVariables)
        .range([0, innerWidth])
        .padding(0.05);
    
    const yScale = d3.scaleBand()
        .domain(corrVariables)
        .range([0, innerHeight])
        .padding(0.05);
    
    let matrixTooltip = d3.select(".matrix-tooltip");
    if (matrixTooltip.empty()) {
        matrixTooltip = d3.select("body").append("div").attr("class", "tooltip matrix-tooltip").style("opacity", 0);
    }
    
    // Celdas
    corrVariables.forEach(rowVar => {
        corrVariables.forEach(colVar => {
            const corr = corrMatrix[rowVar][colVar];
            svg.append("rect")
                .attr("class", "cell")
                .attr("x", xScale(colVar))
                .attr("y", yScale(rowVar))
                .attr("width", xScale.bandwidth())
                .attr("height", yScale.bandwidth())
                .attr("fill", corrColorScale(corr))
                .attr("rx", 3)
                .on("mouseover", function(event) {
                    d3.select(this).attr("stroke", "#333").attr("stroke-width", 2);
                    matrixTooltip.transition().duration(200).style("opacity", 0.9);
                    matrixTooltip.html(`<strong>${varLabels[rowVar]} vs ${varLabels[colVar]}</strong><br/>Correlación: ${corr.toFixed(3)}`)
                        .style("left", (event.pageX + 15) + "px")
                        .style("top", (event.pageY - 30) + "px");
                })
                .on("mouseout", function() {
                    d3.select(this).attr("stroke", "none");
                    matrixTooltip.transition().duration(500).style("opacity", 0);
                });
        });
    });
    
    // Etiquetas horizontales
    svg.selectAll(".x-label")
        .data(corrVariables)
        .enter()
        .append("text")
        .attr("class", "x-label")
        .attr("x", d => xScale(d) + xScale.bandwidth() / 2)
        .attr("y", -15)
        .attr("text-anchor", "start")
        .attr("transform", d => `rotate(-45, ${xScale(d) + xScale.bandwidth() / 2}, -15)`)
        .style("font-size", "11px")
        .text(d => varLabels[d]);
    
    // Etiquetas verticales
    svg.selectAll(".y-label")
        .data(corrVariables)
        .enter()
        .append("text")
        .attr("class", "y-label")
        .attr("x", -15)
        .attr("y", d => yScale(d) + yScale.bandwidth() / 2)
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "middle")
        .style("font-size", "11px")
        .text(d => varLabels[d]);
}

// Redimensionar ventana
window.addEventListener("resize", () => {
    drawLineChart();
    const currentYear = +document.getElementById("year-slider").value;
    drawBubbleChart(currentYear);
    const selectedCountry = document.getElementById("selected-country-name").innerText;
    if (selectedCountry && selectedCountry !== "...") updateDetailChart(selectedCountry);
    const corrYear = +document.getElementById("corr-year-select").value;
    drawCorrelationMatrix(corrYear);
});