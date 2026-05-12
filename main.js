const width = 880;
const height = 960;
const radialCenterY = 390;
const margin = { top: 42, right: 36, bottom: 52, left: 60 };
const quarterNames = new Map([
  [1, "Jan-Mar"],
  [2, "Apr-Jun"],
  [3, "Jul-Sep"],
  [4, "Oct-Dec"],
]);

const metricConfig = {
  mean_brightness: {
    label: "Mean brightness",
    format: d3.format(".3f"),
    lowLabel: "Lower brightness",
    highLabel: "Higher brightness",
    colors: ["#2b164f", "#6a2f7f", "#b84e75", "#f18f55", "#ffe082"],
  },
  bright_pixel_ratio: {
    label: "Bright pixel ratio",
    format: d3.format(".1%"),
    lowLabel: "Lower pixel ratio",
    highLabel: "Higher pixel ratio",
    colors: ["#173f5f", "#20639b", "#3caea3", "#a8d46f", "#f6d55c"],
  },
};

const formatBrightness = metricConfig.mean_brightness.format;
const formatPercent = metricConfig.bright_pixel_ratio.format;
const tooltip = d3.select("#tooltip");

const svg = d3
  .select("#chart")
  .append("svg")
  .attr("viewBox", [0, 0, width, height])
  .attr("role", "img");

const radialLayer = svg
  .append("g")
  .attr("transform", `translate(${width / 2}, ${radialCenterY})`);

const timelineLayer = svg.append("g").attr("transform", `translate(34, ${height - 130})`);

const trendSvg = d3
  .select("#trend-chart")
  .append("svg")
  .attr("viewBox", [0, 0, 920, 320])
  .attr("role", "img");

d3.csv("data/light_Data.csv", d3.autoType).then((data) => {
  data.forEach((d) => {
    d.date = new Date(d.year, (d.quarter - 1) * 3, 1);
    d.label = `${d.quarter_label} ${d.year}`;
  });

  const years = [...new Set(data.map((d) => d.year))].sort((a, b) => a - b);
  const yearSlider = d3.select("#year-slider");
  const currentYearLabel = d3.select("#current-year");
  const playButton = d3.select("#play-button");
  const showAllButton = d3.select("#show-all-button");
  const metricSelect = d3.select("#metric-select");
  const quarterSelect = d3.select("#quarter-select");

  let selectedYear = years[0];
  let activeMetric = metricSelect.property("value");
  let selectedQuarter = "all";
  let timer = null;
  let playing = false;
  let showingAllYears = false;
  let currentMode = "all";

  d3.select("#stat-years").text(`${years[0]}-${years.at(-1)}`);
  d3.select("#stat-quarters").text(data.length);
  d3.select("#stat-samples").text(d3.sum(data, (d) => d.total_days_sampled));

  yearSlider.attr("min", 0).attr("max", years.length - 1).property("value", 0);
  currentYearLabel.text(selectedYear);

  const radiusScale = d3.scalePoint().domain(years).range([58, 326]);
  const sizeScale = d3
    .scaleSqrt()
    .domain(d3.extent(data, (d) => d.bright_pixel_ratio))
    .range([4.5, 14]);

  const colorScales = Object.fromEntries(
    Object.entries(metricConfig).map(([metric, config]) => [
      metric,
      d3
        .scaleQuantize()
        .domain(d3.extent(data, (d) => d[metric]))
        .range(config.colors),
    ])
  );
  const glowScale = d3
    .scaleSqrt()
    .domain(d3.extent(data, (d) => d.bright_pixel_ratio))
    .range([11, 30]);
  const pulseData = years.map((year) => ({
    year,
    values: data.filter((d) => d.year === year).sort((a, b) => a.quarter - b.quarter),
  }));
  const yearlyMetrics = years.map((year) => ({
    year,
    mean_brightness: d3.mean(
      data.filter((d) => d.year === year),
      (d) => d.mean_brightness
    ),
    bright_pixel_ratio: d3.mean(
      data.filter((d) => d.year === year),
      (d) => d.bright_pixel_ratio
    ),
  }));
  const pulseLine = d3
    .line()
    .x((d) => Math.cos(angleForQuarter(d.quarter)) * radiusScale(d.year))
    .y((d) => Math.sin(angleForQuarter(d.quarter)) * radiusScale(d.year))
    .curve(d3.curveLinearClosed);
  const guideArc = d3
    .arc()
    .innerRadius(50)
    .outerRadius(358)
    .padAngle(0.08);

  radialLayer
    .selectAll(".quarter-wedge")
    .data([1, 2, 3, 4])
    .join("path")
    .attr("class", "quarter-wedge")
    .attr("d", (d) =>
      guideArc({
        startAngle: angleForQuarter(d) - Math.PI / 4,
        endAngle: angleForQuarter(d) + Math.PI / 4,
      })
    );

  radialLayer
    .append("circle")
    .attr("r", 42)
    .attr("fill", "#111826")
    .attr("stroke", "#2e3d52");

  radialLayer
    .selectAll(".year-ring")
    .data(years)
    .join("circle")
    .attr("class", "year-ring")
    .attr("r", (d) => radiusScale(d))
    .attr("fill", "none")
    .attr("stroke", "#2e3d52")
    .attr("stroke-width", 1);

  radialLayer
    .selectAll(".quarter-axis")
    .data([1, 2, 3, 4])
    .join("line")
    .attr("class", "quarter-axis")
    .attr("x1", (d) => Math.cos(angleForQuarter(d)) * 56)
    .attr("y1", (d) => Math.sin(angleForQuarter(d)) * 56)
    .attr("x2", (d) => Math.cos(angleForQuarter(d)) * 360)
    .attr("y2", (d) => Math.sin(angleForQuarter(d)) * 360);

  const pulsePaths = radialLayer
    .selectAll(".seasonal-pulse")
    .data(pulseData, (d) => d.year)
    .join("path")
    .attr("class", "seasonal-pulse")
    .attr("d", (d) => pulseLine(d.values))
    .attr("opacity", 0);

  radialLayer
    .selectAll(".quarter-label")
    .data([1, 2, 3, 4])
    .join("text")
    .attr("class", "quarter-label")
    .attr("x", (d) => Math.cos(angleForQuarter(d)) * 376)
    .attr("y", (d) => Math.sin(angleForQuarter(d)) * 376)
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .text((d) => quarterNames.get(d));

  radialLayer
    .selectAll(".year-label")
    .data(years.filter((_, i) => i % 2 === 0 || i === years.length - 1))
    .join("text")
    .attr("class", "year-label")
    .attr("x", 8)
    .attr("y", (d) => -radiusScale(d) - 4)
    .text((d) => d);

  const glows = radialLayer
    .selectAll(".quarter-glow")
    .data(data, (d) => d.label)
    .join("circle")
    .attr("class", "quarter-glow")
    .attr("cx", (d) => Math.cos(angleForQuarter(d.quarter)) * radiusScale(d.year))
    .attr("cy", (d) => Math.sin(angleForQuarter(d.quarter)) * radiusScale(d.year))
    .attr("r", (d) => glowScale(d.bright_pixel_ratio))
    .attr("fill", (d) => colorScales[activeMetric](d[activeMetric]))
    .attr("opacity", 0);

  const dots = radialLayer
    .selectAll(".quarter-dot")
    .data(data, (d) => d.label)
    .join("circle")
    .attr("class", "quarter-dot")
    .attr("cx", (d) => Math.cos(angleForQuarter(d.quarter)) * radiusScale(d.year))
    .attr("cy", (d) => Math.sin(angleForQuarter(d.quarter)) * radiusScale(d.year))
    .attr("r", (d) => sizeScale(d.bright_pixel_ratio))
    .attr("fill", (d) => colorScales[activeMetric](d[activeMetric]))
    .attr("stroke", "#f8fafc")
    .attr("stroke-width", 1.3)
    .on("mouseenter", function (event, d) {
      d3.select(this).raise().attr("stroke-width", 4).attr("opacity", 1);
      tooltip
        .style("opacity", 1)
        .html(`
          <strong>${d.label}</strong><br>
          ${metricConfig[activeMetric].label}: ${formatMetric(d[activeMetric], activeMetric)}<br>
          Dot size: ${formatPercent(d.bright_pixel_ratio)} bright-pixel share<br>
          Max brightness: ${formatBrightness(d.max_brightness)}
        `);
    })
    .on("mousemove", (event) => {
      tooltip.style("left", `${event.pageX + 16}px`).style("top", `${event.pageY - 18}px`);
    })
    .on("mouseleave", function () {
      d3.select(this).attr("stroke-width", 1.3);
      tooltip.style("opacity", 0);
      if (showingAllYears) {
        showAllYears();
      } else {
        render();
      }
    });

  const centerAnnotation = radialLayer.append("g").attr("class", "center-annotation");
  centerAnnotation.append("text").attr("class", "center-title").attr("text-anchor", "middle").attr("y", -12);
  centerAnnotation.append("text").attr("class", "center-line brightest").attr("text-anchor", "middle").attr("y", 10);
  centerAnnotation.append("text").attr("class", "center-line lowest").attr("text-anchor", "middle").attr("y", 30);

  const miniTimeline = buildMiniTimeline(yearlyMetrics);
  const trend = buildTrendChart(data, activeMetric, colorScales[activeMetric]);

  yearSlider.on("input", function () {
    stopPlayback();
    showingAllYears = false;
    selectedYear = years[+this.value];
    render();
  });

  metricSelect.on("change", function () {
    activeMetric = this.value;
    if (showingAllYears) {
      showAllYears();
    } else {
      render();
    }
  });

  quarterSelect.on("change", function () {
    selectedQuarter = this.value === "all" ? "all" : +this.value;
    applyVisibility();
    updateFilterNote();
  });

  playButton.on("click", () => {
    if (playing) {
      stopPlayback();
      return;
    }

    if (currentMode === "all" || +yearSlider.property("value") >= years.length - 1) {
      yearSlider.property("value", 0);
      selectedYear = years[0];
      render();
    }

    playing = true;
    playButton.text("Pause").attr("aria-label", "Pause animation");

    timer = d3.interval(() => {
      const currentIndex = +yearSlider.property("value");
      const nextIndex = Math.min(currentIndex + 1, years.length - 1);

      yearSlider.property("value", nextIndex);
      selectedYear = years[nextIndex];
      render();

      if (nextIndex >= years.length - 1) {
        finishPlayback();
      }
    }, 950);
  });

  showAllButton.on("click", () => {
    stopPlayback();
    selectedYear = years.at(-1);
    yearSlider.property("value", years.length - 1);
    showAllYears();
  });

  yearSlider.property("value", years.length - 1);
  showAllYears();

  function render() {
    showingAllYears = false;
    currentMode = "year";
    currentYearLabel.text(selectedYear);
    d3.select("#selected-title").text(selectedYear);

    dots
      .transition()
      .duration(260)
      .attr("stroke", (d) => (d.year === selectedYear ? "#ffffff" : "#6b7280"));

    glows
      .transition()
      .duration(260)
      .attr("r", (d) => glowScale(d.bright_pixel_ratio));

    pulsePaths
      .transition()
      .duration(260)
      .attr("stroke-width", (d) => (d.year === selectedYear ? 2 : 0.7))
      .attr("stroke", (d) => (d.year === selectedYear ? "#f4c95d" : "#8ecae6"));

    radialLayer
      .selectAll(".year-ring")
      .transition()
      .duration(260)
      .attr("opacity", (d) => (d === selectedYear ? 0.9 : d < selectedYear ? 0.28 : 0.08))
      .attr("stroke-width", (d) => (d === selectedYear ? 3.5 : 1))
      .style("filter", (d) =>
        d === selectedYear ? "drop-shadow(0 0 7px rgba(244, 201, 93, 0.8))" : null
      );

    updateSeasonList(data.filter((d) => d.year === selectedYear), activeMetric, false);
    updateBrightnessSummary(data.filter((d) => d.year === selectedYear), activeMetric);
    updateCenterAnnotation(centerAnnotation, data.filter((d) => d.year === selectedYear), activeMetric, selectedYear);
    miniTimeline.update(selectedYear, activeMetric, false);
    updateLegend(colorScales[activeMetric], activeMetric);
    trend.update(selectedYear, activeMetric, colorScales[activeMetric], false);
    applyVisibility();
    updateFilterNote();
  }

  function showAllYears() {
    showingAllYears = true;
    currentMode = "all";
    selectedYear = years.at(-1);
    currentYearLabel.text(selectedYear);
    d3.select("#selected-title").text("All years");

    dots
      .transition()
      .duration(320)
      .attr("stroke", "#f8fafc")
      .attr("stroke-width", 1.15);

    glows
      .transition()
      .duration(320)
      .attr("r", (d) => glowScale(d.bright_pixel_ratio));

    pulsePaths
      .transition()
      .duration(320)
      .attr("stroke-width", 0.75)
      .attr("stroke", "#8ecae6");

    radialLayer
      .selectAll(".year-ring")
      .transition()
      .duration(320)
      .attr("opacity", 0.42)
      .attr("stroke-width", (d) => (d === years.at(-1) ? 2.2 : 1))
      .style("filter", null);

    updateSeasonList(getQuarterAverages(data), activeMetric, true);
    updateBrightnessSummary(data, activeMetric, true);
    updateCenterAnnotation(centerAnnotation, data, activeMetric, "All years", true);
    miniTimeline.update(selectedYear, activeMetric, true);
    updateLegend(colorScales[activeMetric], activeMetric);
    trend.update(selectedYear, activeMetric, colorScales[activeMetric], true);
    applyVisibility();
    updateFilterNote();
  }

  function stopPlayback() {
    playing = false;
    playButton.text("Play").attr("aria-label", "Play animation");
    if (timer) {
      timer.stop();
      timer = null;
    }
  }

  function finishPlayback() {
    stopPlayback();
    showAllYears();
  }

  function angleForQuarter(quarter) {
    return ((quarter - 1) * Math.PI) / 2 - Math.PI / 2;
  }

  function applyVisibility() {
    dots
      .transition()
      .duration(220)
      .attr("fill", (d) => colorScales[activeMetric](d[activeMetric]))
      .attr("opacity", (d) => dotOpacity(d));

    glows
      .transition()
      .duration(220)
      .attr("fill", (d) => colorScales[activeMetric](d[activeMetric]))
      .attr("opacity", (d) => glowOpacity(d));

    pulsePaths
      .transition()
      .duration(220)
      .attr("opacity", (d) => pulseOpacity(d));

    radialLayer
      .selectAll(".year-ring")
      .transition()
      .duration(220)
      .attr("opacity", (d) => ringOpacity(d));

    radialLayer
      .selectAll(".quarter-wedge")
      .transition()
      .duration(220)
      .attr("opacity", (d) => (selectedQuarter === "all" || d === selectedQuarter ? 0.05 : 0.012));
  }

  function dotOpacity(d) {
    const base = currentMode === "all" ? 0.92 : d.year === selectedYear ? 1 : d.year < selectedYear ? 0.26 : 0.06;
    return quarterMatches(d) ? base : Math.min(base, 0.08);
  }

  function glowOpacity(d) {
    const base = currentMode === "all" ? 0.18 : d.year === selectedYear ? 0.28 : d.year < selectedYear ? 0.1 : 0.02;
    return quarterMatches(d) ? base : Math.min(base, 0.015);
  }

  function pulseOpacity(d) {
    const base = currentMode === "all" ? 0.08 : d.year === selectedYear ? 0.34 : d.year < selectedYear ? 0.055 : 0.006;
    return selectedQuarter === "all" ? base : base * 0.35;
  }

  function ringOpacity(year) {
    if (currentMode === "all") return selectedQuarter === "all" ? 0.42 : 0.3;
    if (year === selectedYear) return selectedQuarter === "all" ? 0.9 : 0.7;
    if (year < selectedYear) return 0.24;
    return 0.06;
  }

  function quarterMatches(d) {
    return selectedQuarter === "all" || d.quarter === selectedQuarter;
  }

  function updateFilterNote() {
    const note = d3.select("#filter-note");
    if (selectedQuarter === "all") {
      note.text("").classed("is-visible", false);
      return;
    }

    const quarterLabel = quarterNames.get(selectedQuarter);
    const context = currentMode === "all" ? "across all years" : `in ${selectedYear}`;
    note.text(`Showing ${quarterLabel} ${context}.`).classed("is-visible", true);
  }
});

function updateCenterAnnotation(group, rows, metric, title, allYears = false) {
  const brightest = d3.greatest(rows, (d) => d[metric]);
  const lowest = d3.least(rows, (d) => d[metric]);
  if (!brightest || !lowest) return;

  group.select(".center-title").text(title);
  if (allYears) {
    group.select(".brightest").text("");
    group.select(".lowest").text("");
    return;
  }

  group
    .select(".brightest")
    .text(
      `${allYears ? "Brightest overall" : "Brightest"}: ${brightest.quarter_label}${
        allYears ? ` ${brightest.year}` : ""
      }`
    );
  group
    .select(".lowest")
    .text(`${allYears ? "Lowest overall" : "Lowest"}: ${lowest.quarter_label}${allYears ? ` ${lowest.year}` : ""}`);
}

function getQuarterAverages(rows) {
  return Array.from(
    d3.group(rows, (d) => d.quarter),
    ([quarter, values]) => ({
      quarter,
      quarter_label: quarterNames.get(quarter),
      mean_brightness: d3.mean(values, (d) => d.mean_brightness),
      bright_pixel_ratio: d3.mean(values, (d) => d.bright_pixel_ratio),
      max_brightness: d3.max(values, (d) => d.max_brightness),
      total_days_sampled: d3.sum(values, (d) => d.total_days_sampled),
    })
  ).sort((a, b) => a.quarter - b.quarter);
}

function buildMiniTimeline(rows) {
  const timelineWidth = width - 64;
  const timelineHeight = 86;
  const axisWidth = 58;
  const xScale = d3
    .scaleBand()
    .domain(rows.map((d) => d.year))
    .range([axisWidth, timelineWidth])
    .padding(0.18);
  const yScale = d3
    .scaleLinear()
    .range([timelineHeight, 0]);

  const title = timelineLayer.append("text").attr("class", "mini-timeline-title").attr("x", 0).attr("y", -22);
  const yAxis = timelineLayer.append("g").attr("class", "mini-y-axis").attr("transform", `translate(${axisWidth - 12}, 0)`);
  const grid = timelineLayer.append("g").attr("class", "mini-grid");

  timelineLayer
    .append("line")
    .attr("class", "mini-timeline-base")
    .attr("x1", axisWidth)
    .attr("x2", timelineWidth)
    .attr("y1", timelineHeight)
    .attr("y2", timelineHeight);

  const bars = timelineLayer
    .selectAll(".mini-year-bar")
    .data(rows, (d) => d.year)
    .join("rect")
    .attr("class", "mini-year-bar")
    .attr("x", (d) => xScale(d.year))
    .attr("width", xScale.bandwidth())
    .attr("rx", 4);

  const labels = timelineLayer
    .selectAll(".mini-year-label")
    .data(rows.filter((_, i) => i % 2 === 0 || i === rows.length - 1))
    .join("text")
    .attr("class", "mini-year-label")
    .attr("x", (d) => xScale(d.year) + xScale.bandwidth() / 2)
    .attr("y", timelineHeight + 21)
    .attr("text-anchor", "middle")
    .text((d) => d.year);

  function update(selectedYear, metric = "mean_brightness", showAll = false) {
    yScale.domain(d3.extent(rows, (d) => d[metric])).nice();
    title.text(`${metricConfig[metric].label} by year`);

    yAxis
      .transition()
      .duration(240)
      .call(d3.axisLeft(yScale).ticks(3).tickFormat(metricConfig[metric].format).tickSize(0));

    yAxis.select(".domain").remove();

    grid
      .selectAll(".mini-grid-line")
      .data(yScale.ticks(3), (d) => d)
      .join(
        (enter) =>
          enter
            .append("line")
            .attr("class", "mini-grid-line")
            .attr("x1", axisWidth)
            .attr("x2", timelineWidth)
            .attr("y1", (d) => yScale(d))
            .attr("y2", (d) => yScale(d)),
        (update) => update,
        (exit) => exit.remove()
      )
      .transition()
      .duration(240)
      .attr("x1", axisWidth)
      .attr("x2", timelineWidth)
      .attr("y1", (d) => yScale(d))
      .attr("y2", (d) => yScale(d));

    bars
      .transition()
      .duration(240)
      .attr("y", (d) => yScale(d[metric]))
      .attr("height", (d) => timelineHeight - yScale(d[metric]))
      .attr("fill", (d) => (showAll ? "#8ecae6" : d.year === selectedYear ? "#f4c95d" : "#4d6685"))
      .attr("opacity", (d) => (showAll || d.year <= selectedYear ? 0.95 : 0.25));

    labels
      .transition()
      .duration(240)
      .attr("opacity", (d) => (showAll || d.year === selectedYear || d.year === rows.at(-1).year ? 1 : 0.55))
      .attr("fill", (d) => (!showAll && d.year === selectedYear ? "#f4c95d" : "#9fb0c4"));
  }

  update(rows[0].year, "mean_brightness", false);
  return { update };
}

function updateSeasonList(rows, metric, isAggregate = false) {
  const valueMetric = metric;
  const darkest = d3.least(rows, (d) => d[valueMetric]);
  const cards = d3
    .select("#season-list")
    .selectAll(".season-card")
    .data(rows, (d) => d.quarter_label);

  const cardsEnter = cards.enter().append("div").attr("class", "season-card");
  cardsEnter.append("span").attr("class", "season-name");
  cardsEnter.append("span").attr("class", "season-value");
  cardsEnter.append("span").attr("class", "season-meta");

  cards
    .merge(cardsEnter)
    .classed(
      "is-darkest",
      (d) => darkest && d.quarter === darkest.quarter && (!d.year || d.year === darkest.year)
    )
    .select(".season-name")
    .text((d) => d.quarter_label);

  cards
    .merge(cardsEnter)
    .select(".season-value")
    .text((d) => formatMetric(d[valueMetric], valueMetric));

  cards
    .merge(cardsEnter)
    .select(".season-meta")
    .text((d) => (isAggregate ? "Average across all years" : `${d.total_days_sampled} sampled days`));

  cards.exit().remove();
}

function updateBrightnessSummary(rows, metric, allYears = false) {
  const lowest = d3.least(rows, (d) => d[metric]);
  const highest = d3.greatest(rows, (d) => d[metric]);
  if (!lowest || !highest) return;
  const metricName = metricConfig[metric].label.toLowerCase();

  if (allYears) {
    d3.select("#darkest-quarter").html(`
      <strong>Lowest ${metricName} overall:</strong> ${lowest.quarter_label} ${lowest.year} (${formatMetric(lowest[metric], metric)})<br>
      <strong>Highest ${metricName} overall:</strong> ${highest.quarter_label} ${highest.year} (${formatMetric(highest[metric], metric)})
    `);
    return;
  }

  d3.select("#darkest-quarter").html(
    `<strong>Lowest ${metricName}:</strong> ${lowest.quarter_label} (${formatMetric(lowest[metric], metric)})<br>
     <strong>Highest ${metricName}:</strong> ${highest.quarter_label} (${formatMetric(highest[metric], metric)})`
  );
}

function updateLegend(scale, metric) {
  const config = metricConfig[metric];
  const colors = scale.range();
  const [domainMin, domainMax] = scale.domain();
  const thresholds = scale.thresholds();
  const ranges = colors.map((color, i) => ({
    color,
    start: i === 0 ? domainMin : thresholds[i - 1],
    end: i === colors.length - 1 ? domainMax : thresholds[i],
  }));

  const legend = d3.select("#color-legend").html("");
  legend.append("p").attr("class", "legend-title").text(config.label);

  const rows = legend
    .append("div")
    .attr("class", "legend-ranges")
    .selectAll(".legend-range")
    .data(ranges)
    .join("div")
    .attr("class", "legend-range");

  rows.append("span").attr("class", "legend-chip").style("background", (d) => d.color);
  rows
    .append("span")
    .attr("class", "legend-range-label")
    .text((d) => `${formatMetric(d.start, metric)} to ${formatMetric(d.end, metric)}`);

  legend
    .append("div")
    .attr("class", "legend-endpoints")
    .html(`<span>${config.lowLabel}</span><span>${config.highLabel}</span>`);
}

function buildTrendChart(data, metric, colorScale) {
  const innerWidth = 920 - margin.left - margin.right;
  const innerHeight = 320 - margin.top - margin.bottom;

  const chart = trendSvg
    .append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

  const xScale = d3.scaleTime().domain(d3.extent(data, (d) => d.date)).range([0, innerWidth]);
  const yScale = d3.scaleLinear().range([innerHeight, 0]).nice();

  chart
    .append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0, ${innerHeight})`);

  chart.append("g").attr("class", "y-axis");
  chart.append("path").attr("class", "trend-line").attr("fill", "none").attr("stroke-width", 2.5);
  chart.append("g").attr("class", "trend-points");
  chart.append("text").attr("class", "axis-label y-label").attr("x", 0).attr("y", -18);

  function update(selectedYear, selectedMetric, selectedColorScale, showAll = false) {
    yScale.domain(d3.extent(data, (d) => d[selectedMetric])).nice();

    const line = d3
      .line()
      .x((d) => xScale(d.date))
      .y((d) => yScale(d[selectedMetric]));

    chart.select(".x-axis").call(d3.axisBottom(xScale).ticks(7).tickSizeOuter(0));
    chart
      .select(".y-axis")
      .transition()
      .duration(220)
      .call(d3.axisLeft(yScale).ticks(5));

    chart.select(".y-label").text(metricConfig[selectedMetric].label);

    chart
      .select(".trend-line")
      .datum(data)
      .transition()
      .duration(260)
      .attr("d", line)
      .attr("stroke", "#8ecae6");

    chart
      .select(".trend-points")
      .selectAll("circle")
      .data(data, (d) => d.label)
      .join("circle")
      .attr("cx", (d) => xScale(d.date))
      .attr("cy", (d) => yScale(d[selectedMetric]))
      .attr("r", (d) => (showAll || d.year === selectedYear ? 4.5 : 3))
      .attr("fill", (d) => selectedColorScale(d[selectedMetric]))
      .attr("stroke", (d) => (!showAll && d.year === selectedYear ? "#ffffff" : "#172033"))
      .attr("stroke-width", (d) => (!showAll && d.year === selectedYear ? 2 : 1))
      .attr("opacity", (d) => (showAll || d.year === selectedYear ? 1 : 0.45));
  }

  update(data[0].year, metric, colorScale);
  return { update };
}

function formatMetric(value, metric) {
  return metricConfig[metric].format(value);
}

// test for commit change
