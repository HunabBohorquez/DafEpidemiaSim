/**
 * EpidemiaSim - Core Engine
 * JS ES6+ Vanilla
 */

// PRNG Generator (Mulberry32) para reproducibilidad
class PRNG {
    constructor(seed) {
        this.seed = seed;
    }
    next() {
        let t = this.seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
    randomRange(min, max) {
        return min + this.next() * (max - min);
    }
}

// Estados Epidemiológicos
const STATES = {
    SUSCEPTIBLE: 0,
    INFECTED: 1,
    RECOVERED: 2,
    IMMUNE: 3
};

const COLORS = {
    [STATES.SUSCEPTIBLE]: '#00bcd4',
    [STATES.INFECTED]: '#f44336',
    [STATES.RECOVERED]: '#4caf50',
    [STATES.IMMUNE]: '#9c27b0'
};

class Agent {
    constructor(x, y, vx, vy, state, isStatic) {
        this.x = x;
        this.y = y;
        this.vx = isStatic ? 0 : vx;
        this.vy = isStatic ? 0 : vy;
        this.radius = 4;
        this.state = state;
        this.infectionTimer = 0;
    }

    update(width, height, barrierActive, gateOpen) {
        let nextX = this.x + this.vx;
        let nextY = this.y + this.vy;

        // Rebotes en bordes exteriores
        if (nextX - this.radius < 0) { this.x = this.radius; this.vx *= -1; }
        else if (nextX + this.radius > width) { this.x = width - this.radius; this.vx *= -1; }
        else { this.x = nextX; }

        if (nextY - this.radius < 0) { this.y = this.radius; this.vy *= -1; }
        else if (nextY + this.radius > height) { this.y = height - this.radius; this.vy *= -1; }
        else { this.y = nextY; }

        // Colisión con la barrera central
        if (barrierActive) {
            const midX = width / 2;
            const gateY1 = height / 2 - 40;
            const gateY2 = height / 2 + 40;
            const inGateY = this.y > gateY1 && this.y < gateY2;

            if (!gateOpen || !inGateY) {
                // Acercándose desde la izquierda
                if (this.x < midX && this.vx > 0 && this.x + this.radius >= midX - 2) {
                    this.x = midX - this.radius - 2;
                    this.vx *= -1;
                }
                // Acercándose desde la derecha
                else if (this.x > midX && this.vx < 0 && this.x - this.radius <= midX + 2) {
                    this.x = midX + this.radius + 2;
                    this.vx *= -1;
                }
            }
        }
    }

    draw(ctx, contagionRadius) {
        // Círculo de contagio si está infectado
        if (this.state === STATES.INFECTED) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, contagionRadius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(244, 67, 54, 0.15)';
            ctx.fill();
        }
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = COLORS[this.state];
        ctx.fill();
        ctx.closePath();
    }
}

class SirSimulationEngine {
    constructor(canvas, ui) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;
        this.ui = ui;
        this.agents = [];
        this.history = []; // Para CSV y gráfica
        this.ticks = 0;
        this.isRunning = false;
        this.speed = 1;
        this.peakInfected = 0;
        
        this.prng = new PRNG(42);

        this.canvas.addEventListener('mousedown', (e) => this.injectPatientZero(e));
    }

    init(params) {
        this.agents = [];
        this.history = [];
        this.ticks = 0;
        this.peakInfected = 0;
        this.params = params;
        this.prng = new PRNG(params.seed);

        const total = params.population;
        const vaxCount = Math.floor(total * (params.vaxRate / 100));
        const distCount = Math.floor(total * (params.distRate / 100));

        let vaxAssigned = 0;
        let distAssigned = 0;

        for (let i = 0; i < total; i++) {
            let x = this.prng.randomRange(10, this.width - 10);
            let y = this.prng.randomRange(10, this.height - 10);
            
            // Si la barrera está cerrada, repartir a los lados
            if (params.barrier) {
                if (i % 2 === 0) x = this.prng.randomRange(10, this.width/2 - 20);
                else x = this.prng.randomRange(this.width/2 + 20, this.width - 10);
            }

            let angle = this.prng.randomRange(0, Math.PI * 2);
            let speed = this.prng.randomRange(0.5, 1.5);
            let vx = Math.cos(angle) * speed;
            let vy = Math.sin(angle) * speed;

            let state = STATES.SUSCEPTIBLE;
            if (vaxAssigned < vaxCount) {
                state = STATES.IMMUNE;
                vaxAssigned++;
            }

            let isStatic = false;
            if (distAssigned < distCount) {
                isStatic = true;
                distAssigned++;
            }

            this.agents.push(new Agent(x, y, vx, vy, state, isStatic));
        }

        // Infectar uno inicial si no hay vacunación del 100%
        if (vaxCount < total) {
            let susceptibleAgents = this.agents.filter(a => a.state === STATES.SUSCEPTIBLE);
            if (susceptibleAgents.length > 0) {
                susceptibleAgents[0].state = STATES.INFECTED;
            }
        }
        
        this.recordStats();
        this.draw();
    }

    update() {
        if (!this.isRunning) return;

        for (let s = 0; s < this.speed; s++) {
            this.ticks++;

            // Mover agentes
            for (let agent of this.agents) {
                agent.update(this.width, this.height, this.params.barrier, this.params.gate);
                
                // Progreso de infección
                if (agent.state === STATES.INFECTED) {
                    agent.infectionTimer++;
                    if (agent.infectionTimer >= this.params.duration) {
                        agent.state = STATES.RECOVERED;
                    }
                }
            }

            // Chequeo espacial de contagios (O(N^2) ingenuo, manejable para 300 agentes)
            let infected = this.agents.filter(a => a.state === STATES.INFECTED);
            let susceptibles = this.agents.filter(a => a.state === STATES.SUSCEPTIBLE);

            for (let inf of infected) {
                for (let sus of susceptibles) {
                    if (sus.state === STATES.SUSCEPTIBLE) {
                        let dx = inf.x - sus.x;
                        let dy = inf.y - sus.y;
                        let dist2 = dx*dx + dy*dy;
                        let r2 = this.params.radius * this.params.radius;

                        if (dist2 <= r2) {
                            if (this.prng.next() < (this.params.prob / 100)) {
                                sus.state = STATES.INFECTED;
                            }
                        }
                    }
                }
            }
            this.recordStats();
        }
        this.draw();
    }

    draw() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Dibujar barrera
        if (this.params.barrier) {
            this.ctx.fillStyle = '#666';
            let midX = this.width / 2;
            let gapY = this.height / 2;
            
            if (this.params.gate) {
                this.ctx.fillRect(midX - 2, 0, 4, gapY - 40);
                this.ctx.fillRect(midX - 2, gapY + 40, 4, this.height - gapY - 40);
            } else {
                this.ctx.fillRect(midX - 2, 0, 4, this.height);
            }
        }

        for (let agent of this.agents) {
            agent.draw(this.ctx, this.params.radius);
        }
    }

    injectPatientZero(event) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        let closest = null;
        let minDist = Infinity;

        for (let a of this.agents) {
            if (a.state === STATES.SUSCEPTIBLE) {
                let d = Math.hypot(a.x - mouseX, a.y - mouseY);
                if (d < minDist) {
                    minDist = d;
                    closest = a;
                }
            }
        }

        if (closest) {
            closest.state = STATES.INFECTED;
            this.draw();
        }
    }

    recordStats() {
        let stats = { S: 0, I: 0, R: 0, V: 0 };
        for (let a of this.agents) {
            if (a.state === STATES.SUSCEPTIBLE) stats.S++;
            else if (a.state === STATES.INFECTED) stats.I++;
            else if (a.state === STATES.RECOVERED) stats.R++;
            else if (a.state === STATES.IMMUNE) stats.V++;
        }
        if (stats.I > this.peakInfected) this.peakInfected = stats.I;
        
        this.history.push({ tick: this.ticks, ...stats });
        this.ui.updateDashboard(stats, this.peakInfected);
    }
}

class EpidemicChartRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;
    }

    draw(history, maxPop) {
        this.ctx.clearRect(0, 0, this.width, this.height);
        if (history.length === 0) return;

        // Línea de capacidad hospitalaria (25%)
        let hospY = this.height - (this.height * 0.25);
        this.ctx.beginPath();
        this.ctx.setLineDash([5, 5]);
        this.ctx.moveTo(0, hospY);
        this.ctx.lineTo(this.width, hospY);
        this.ctx.strokeStyle = '#ffffff88';
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        this.ctx.fillText("Capacidad Hosp. (25%)", 5, hospY - 5);

        const dataLen = history.length;
        const xStep = this.width / Math.max(dataLen, 100);

        const drawCurve = (key, color) => {
            this.ctx.beginPath();
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = 2;
            for (let i = 0; i < dataLen; i++) {
                let x = i * xStep;
                // Scroll if data exceeds width
                if (dataLen > 100) x = (i - (dataLen - 100)) * (this.width/100);
                
                let y = this.height - (history[i][key] / maxPop) * this.height;
                if (i === 0) this.ctx.moveTo(x, y);
                else this.ctx.lineTo(x, y);
            }
            this.ctx.stroke();
        };

        drawCurve('S', COLORS[STATES.SUSCEPTIBLE]);
        drawCurve('V', COLORS[STATES.IMMUNE]);
        drawCurve('R', COLORS[STATES.RECOVERED]);
        drawCurve('I', COLORS[STATES.INFECTED]);
    }
}

class UIController {
    constructor() {
        this.simCanvas = document.getElementById('sim-canvas');
        this.chartCanvas = document.getElementById('chart-canvas');
        this.chartRenderer = new EpidemicChartRenderer(this.chartCanvas);
        this.engine = new SirSimulationEngine(this.simCanvas, this);
        
        this.bindDOM();
        this.applyParamsAndReset();
        this.loop();
    }

    getParams() {
        return {
            seed: parseInt(document.getElementById('seed-input').value) || 42,
            population: parseInt(document.getElementById('slider-pop').value),
            radius: parseInt(document.getElementById('slider-radius').value),
            prob: parseInt(document.getElementById('slider-prob').value),
            duration: parseInt(document.getElementById('slider-duration').value),
            distRate: parseInt(document.getElementById('slider-dist').value),
            vaxRate: parseInt(document.getElementById('slider-vax').value),
            barrier: document.getElementById('check-barrier').checked,
            gate: document.getElementById('check-gate').checked
        };
    }

    bindDOM() {
        const updateVal = (idSlider, idVal) => {
            const el = document.getElementById(idSlider);
            document.getElementById(idVal).innerText = el.value;
            el.addEventListener('input', () => document.getElementById(idVal).innerText = el.value);
        };

        updateVal('slider-pop', 'val-pop');
        updateVal('slider-radius', 'val-radius');
        updateVal('slider-prob', 'val-prob');
        updateVal('slider-duration', 'val-duration');
        updateVal('slider-dist', 'val-dist');
        updateVal('slider-vax', 'val-vax');

        document.getElementById('btn-start').addEventListener('click', () => {
            this.engine.isRunning = !this.engine.isRunning;
        });

        document.getElementById('btn-reset').addEventListener('click', () => this.applyParamsAndReset());
        
        document.getElementById('btn-speed').addEventListener('click', (e) => {
            this.engine.speed = this.engine.speed === 1 ? 2 : 1;
            e.target.innerText = `Velocidad: ${this.engine.speed}x`;
        });

        const barrierCheck = document.getElementById('check-barrier');
        const gateCheck = document.getElementById('check-gate');
        barrierCheck.addEventListener('change', (e) => {
            gateCheck.disabled = !e.target.checked;
            this.engine.params.barrier = e.target.checked;
            this.engine.draw();
        });
        gateCheck.addEventListener('change', (e) => {
            this.engine.params.gate = e.target.checked;
            this.engine.draw();
        });

        document.getElementById('preset-select').addEventListener('change', (e) => this.applyPreset(e.target.value));
        
        document.getElementById('btn-export').addEventListener('click', () => this.exportCSV());
    }

    applyPreset(preset) {
        if (preset === 'none') return;
        
        document.getElementById('check-barrier').checked = false;
        document.getElementById('check-gate').checked = false;
        document.getElementById('check-gate').disabled = true;

        if (preset === 'libre') {
            document.getElementById('slider-dist').value = 0;
            document.getElementById('slider-vax').value = 0;
        } else if (preset === 'distanciamiento') {
            document.getElementById('slider-dist').value = 70;
            document.getElementById('slider-vax').value = 0;
        } else if (preset === 'rebaño') {
            document.getElementById('slider-dist').value = 0;
            document.getElementById('slider-vax').value = 75;
        } else if (preset === 'cuarentena') {
            document.getElementById('check-barrier').checked = true;
            document.getElementById('check-gate').disabled = false;
            document.getElementById('slider-dist').value = 0;
            document.getElementById('slider-vax').value = 0;
        }

        // Disparar eventos de input para actualizar labels
        ['slider-dist', 'slider-vax'].forEach(id => {
            document.getElementById(id).dispatchEvent(new Event('input'));
        });

        this.applyParamsAndReset();
    }

    applyParamsAndReset() {
        this.engine.isRunning = false;
        this.engine.init(this.getParams());
        this.chartRenderer.draw(this.engine.history, this.engine.params.population);
    }

    updateDashboard(stats, peak) {
        document.getElementById('count-s').innerText = stats.S;
        document.getElementById('count-i').innerText = stats.I;
        document.getElementById('count-r').innerText = stats.R;
        document.getElementById('count-v').innerText = stats.V;
        document.getElementById('count-peak').innerText = peak;
    }

    exportCSV() {
        let csv = "Tick,Susceptibles,Infectados,Recuperados,Inmunes\n";
        this.engine.history.forEach(row => {
            csv += `${row.tick},${row.S},${row.I},${row.R},${row.V}\n`;
        });
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('href', url);
        a.setAttribute('download', 'historial_epidemia.csv');
        a.click();
    }

    loop() {
        requestAnimationFrame(() => this.loop());
        if (this.engine.isRunning) {
            this.engine.update();
            this.chartRenderer.draw(this.engine.history, this.engine.params.population);
        }
    }
}

// Inicializar al cargar
window.onload = () => new UIController();
