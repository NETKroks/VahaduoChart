

const createElement = (htmlString) => {
    const template = document.createElement('template');
    template.innerHTML = htmlString.trim();
    return template.content.firstChild;
};

const generateColorsAdvanced = (count) => {
    const baseColors = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
        '#FF9F40', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
        '#FECA57', '#FF9FF3'
    ];

    if (count <= 12) {
        return baseColors.slice(0, count);
    }

    const colors = [...baseColors];
    count -= baseColors.length;

    const goldenRatio = 0.618033988749895;
    let hue = Math.random();

    for (let i = 0; i < count; i++) {
        hue += goldenRatio;
        hue %= 1;

        const saturation = 65 + (i % 3) * 10;
        const lightness = 50 + (i % 4) * 8;

        colors.push(`hsl(${Math.floor(hue * 360)}, ${saturation}%, ${lightness}%)`);
    }

    return colors;
};

const calculateStdDev = (values) => {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
};

let chartData = null;
let chartInstance = null;

const createPieChartFromTable = () => {
    const table = document.querySelector('.multitablewrapper table tbody');
    if (!table) {
        console.error('Table not found!');
        return;
    }

    const rows = Array.from(table.querySelectorAll('tr'));

    const headerRow = rows[0];
    const populationCells = Array.from(headerRow.querySelectorAll('td.multisources span'));
    const populations = populationCells.map(cell => cell.textContent.trim());

    let avgRowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
        const firstCell = rows[i].querySelector('td.multitargets');
        if (firstCell && firstCell.textContent.trim() === 'Average') {
            avgRowIndex = i;
            break;
        }
    }

    if (avgRowIndex === -1) {
        console.error('Average row not found!');
        return;
    }

    const avgRow = rows[avgRowIndex];
    const avgCells = Array.from(avgRow.querySelectorAll('td.multiresult'));

    const averages = avgCells.map(cell => {
        const text = cell.textContent.trim();
        const value = parseFloat(text);
        return value;
    });

    const sampleData = {};
    populations.forEach(pop => {
        sampleData[pop] = [];
    });

    for (let i = 1; i < avgRowIndex; i++) {
        const row = rows[i];
        const cells = Array.from(row.querySelectorAll('td.multiresult'));

        cells.forEach((cell, index) => {
            if (index < populations.length) {
                const value = parseFloat(cell.textContent.trim());
                if (!isNaN(value)) {
                    sampleData[populations[index]].push(value);
                }
            }
        });
    }

    const ancestryDataWithStdDev = {};
    const minLength = Math.min(populations.length, averages.length);
    for (let i = 0; i < minLength; i++) {
        if (!isNaN(averages[i]) && averages[i] > 0) {
            const stdDev = calculateStdDev(sampleData[populations[i]]);
            ancestryDataWithStdDev[populations[i]] = {
                mean: averages[i],
                stdDev: stdDev
            };
        }
    }

    const filteredData = Object.entries(ancestryDataWithStdDev)
        .filter(([, data]) => data.mean >= 1.0)
        .sort((a, b) => b[1].mean - a[1].mean);

    if (filteredData.length === 0) {
        const lowFilterData = Object.entries(ancestryDataWithStdDev)
            .filter(([, data]) => data.mean >= 0.1)
            .sort((a, b) => b[1].mean - a[1].mean);

        if (lowFilterData.length === 0) {
            console.error('Still no data found!');
            return;
        } else {
            chartData = lowFilterData;
            createChart();
            return;
        }
    }

    chartData = filteredData;
    createChart();
};

const renderChart = () => {
    const canvas = document.getElementById('ancestryChart');
    if (!canvas) return;

    if (chartInstance) {
        chartInstance.destroy();
    }

    const colors = generateColorsAdvanced(chartData.length);
    const ctx = canvas.getContext('2d');

    chartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: chartData.map(([name, data]) => `${name} (${data.mean}% ± ${data.stdDev.toFixed(1)})`),
            datasets: [{
                data: chartData.map(([name, data]) => data.mean),
                backgroundColor: colors,
                borderColor: '#fff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Genetic Ancestry Distribution',
                    font: { size: 16, weight: 'bold' },
                    color: '#ffffff'
                },
                legend: {
                    position: 'right',
                    labels: {
                        padding: 10,
                        usePointStyle: true,
                        font: { size: 12 },
                        color: '#ffffff'
                    }
                },
                tooltip: {
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    callbacks: {
                        label: function (context) {
                            const index = context.dataIndex;
                            const [name, data] = chartData[index];
                            return [
                                `${name}: ${data.mean}%`,
                                `Std Dev: ± ${data.stdDev.toFixed(2)}%`
                            ];
                        }
                    }
                }
            }
        }
    });
};

const saveChart = () => {
    if (!chartInstance) return;

    const canvas = document.getElementById('ancestryChart');
    const url = canvas.toDataURL('image/png');

    const link = document.createElement('a');
    link.download = 'ancestry-chart.png';
    link.href = url;
    link.click();
};

const toggleChart = (button, chartContainer) => {
    const isVisible = chartContainer.style.display !== 'none';

    if (isVisible) {
        if (chartInstance) {
            chartInstance.destroy();
            chartInstance = null;
        }
        chartContainer.style.display = 'none';
        button.textContent = 'Open Chart';
    } else {
        chartContainer.style.display = 'block';
        button.textContent = 'Close Chart';
        setTimeout(renderChart, 100);
    }
};

const createChart = () => {
    const existing = document.getElementById('ancestryChartSection');
    if (existing) existing.remove();

    const multiOutput = document.getElementById('multioutput');
    if (!multiOutput) {
        console.error('Could not find multioutput div');
        return;
    }

    const chartSection = createElement(`
        <div id="ancestryChartSection" style="margin-top: 20px; text-align: center;"></div>
    `);


    const chartContainer = createElement(`
        <div id="chartContainer" style="width: 800px; height: 600px; margin: 0 auto; position: relative;"></div>
    `);

    const canvas = createElement(`
        <canvas id="ancestryChart" style="max-width: 100%; max-height: 100%;"></canvas>
    `);

    const buttonContainer = createElement(`
        <div style="margin-top: 15px;"></div>
    `);

    const toggleBtn = createElement(`
        <button class="buttons buttonmulti" style="margin-right: 10px;">close&nbsp;chart</button>
    `);
    toggleBtn.onclick = () => toggleChart(toggleBtn, chartContainer);

    const saveBtn = createElement(`
        <button class="buttons buttonmulti">save&nbsp;chart</button>
    `);
    saveBtn.onclick = saveChart;

    chartContainer.appendChild(canvas);
    buttonContainer.appendChild(toggleBtn);
    buttonContainer.appendChild(saveBtn);

    chartSection.appendChild(chartContainer);
    chartSection.appendChild(buttonContainer);

    multiOutput.appendChild(chartSection);

    renderChart();
};

const hookRunButton = () => {
    const runButton = document.getElementById('runmulti');
    if (!runButton) {
        console.error('Run button not found!');
        return;
    }

    runButton.addEventListener('click', () => {
        console.log('Run button clicked, rendering chart...');
        setTimeout(() => {
            if (chartData) {
                renderChart();
            } else {
                createPieChartFromTable();
            }
        }, 100);
    });
}


const initializeChartJs = () => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    script.onload = () => {
        createPieChartFromTable();
    };
    document.head.appendChild(script);
}

hookRunButton();
if (typeof Chart === 'undefined') {
    injectChartJs();
    return;
}

createPieChartFromTable();