'use strict';

/*
 * Created with @iobroker/create-adapter v1.17.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');

// Load your modules here, e.g.:
const http = require('http');

let lang = 'de';
let ip = '';
let baseLevel = 50; // bedeutet: in der Webseite wird ein Balken von 100% Höhe 50px hoch gezeichnet. 
                    // Also entspricht ein gezeigtes Tintenlevel von 25 (px) dann 50% und eines von 10 (px) dann 20%
let link = '';
let runTimeout;
const ink = {
    'cyan' : {
        'state': 'cyan',
        'name': 'Cyan',
        'cut':  'Ink_C.PNG',
        'cartridge': 'T2422',
        'slot': '4'
    },
    'cyanlight' : {
        'state': 'cyanlight',
        'name': 'Cyan Light',
        'cut':  'Ink_LC.PNG',
        'cartridge': 'T2425',
        'slot': '2'
    },
    'yellow' : {
        'state': 'yellow',
        'name': 'Yellow',
        'cut':  'Ink_Y.PNG',
        'cartridge': 'T2424',
        'slot': '5'
    },
    'black' : {
        'state': 'black',
        'name': 'Black',
        'cut':  'Ink_K.PNG',
        'cartridge': 'T2421',
        'slot': '1'
    },
    'magenta' : {
        'state': 'magenta',
        'name': 'Magenta',
        'cut':  'Ink_M.PNG',
        'cartridge': 'T2423',
        'slot': '3'
    },
    'magentalight' : {
        'state': 'magentalight',
        'name': 'Magenta Light',
        'cut':  'Ink_LM.PNG',
        'cartridge': 'T2426',
        'slot': '6'
    }
};

class epson_xp860 extends utils.Adapter {

    /**
     * @param {Partial<ioBroker.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: 'epson_xp860',
        });
        this.on('ready', this.onReady.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // Initialize your adapter here
        this.main();

    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            clearTimeout(runTimeout);
            this.log.info('cleaned everything up...');
            callback();
        } catch (e) {
            callback();
        }
    }

    readSettings() {
        //check if IP is entered in settings
        if (!this.config.printerip) {
            this.log.warn('Please set up the Printer IP address in the Adapter-Config. Adapter will be stopped.');
            return false;
        } 
        else {
            ip = (this.config.printerport.length > 0) ? this.config.printerip + ':' + this.config.printerport : this.config.printerip; // if port is set then ip+port else ip only
            this.log.debug('IP: ' + ip);
            link = 'http://' + ip + '/PRESENTATION/HTML/TOP/PRTINFO.HTML';
            this.setState('printerInfo.ip', {
                val: ip,
                ack: false
            });
            return true;
        }
    }

    readPrinter() {

        const nameCutStart = 'Druckername',
              nameCutEnd = 'Verbindungsstatus',
              modelCutStart = '<title>',
              modelCutEnd = '</title>',
              macCutStart = 'MAC-Adresse',
              macCutEnd = 'info-wfd',
              connectCutStart = 'Verbindungsstatus',
              connectCutEnd = 'IP-Adresse beziehen';
        let requestResponded,
            responseTime;

        http.get(link, (response) => {
            let body = '';

            // called when a data chunk is received.
            response.on('data', (chunk) => {
            body += chunk;
            });

            // called when the complete response is received.
            response.on('end', () => {
                requestResponded = true;
                this.setState('printerInfo.ip', {
                    val: ip,
                    ack: true
                });
                // NAME EINLESEN
                let nameCutStartPosition = body.indexOf(nameCutStart) + nameCutStart.length + 41,
                nameCutEndPosition = body.indexOf(nameCutEnd) -64;
                let nameString = body.substring(nameCutStartPosition, nameCutEndPosition);
                this.setState('printerInfo.name', {val: nameString, ack: true});
                this.log.debug('Printer-Name: ' + nameString);

                // MODELL EINLESEN
                let modelCutStartPosition = body.indexOf(modelCutStart) + modelCutStart.length,
                modelCutEndPosition = body.indexOf(modelCutEnd);
                let modelString = body.substring(modelCutStartPosition, modelCutEndPosition);
                this.setState('printerInfo.model', {val: modelString, ack: true});
                this.log.debug('Printer-Model: ' + modelString);

                // MAC ADRESSE EINLESEN
                let macCutStartPosition = body.indexOf(macCutStart) + macCutStart.length + 41,
                macCutEndPosition = body.indexOf(macCutEnd) - 39;
                let macString = body.substring(macCutStartPosition, macCutEndPosition);
                this.setState('printerInfo.mac', {val: macString, ack: true});
                this.log.debug('Printer-MAC: ' + macString);

                // CONNECTION EINLESEN
                let connectCutStartPosition = body.indexOf(connectCutStart) + connectCutStart.length + 41,
                connectCutEndPosition = body.indexOf(connectCutEnd) - 64;
                let connectString = body.substring(connectCutStartPosition, connectCutEndPosition);
                this.setState('printerInfo.connection', {val: connectString, ack: true});
                this.log.debug('Printer-Connection: ' + connectString);

                for (let i in ink) {
                    this.setObjectNotExists('ink_' + ink[i].state, {
                        type: 'state',
                        common: {
                            name: 'Level of Cartridge ' + ink[i].cartridge + ' ' + ink[i].name,
                            desc: 'Level of Cartridge ' + ink[i].cartridge + ' ' + ink[i].name,
                            type: 'number',
                            unit: '%',
                            min: 0,
                            max: 100,
                            read: true,
                            write: false,
                            role: 'value.level'
                        },
                        native: {}
                    });

                    // READ LEVELS
                    let levelCutPosition = body.indexOf(ink[i].cut) + ink[i].cut.length + 10;
                    let levelString = body.substring(levelCutPosition, levelCutPosition + 12);
                    let level = parseInt(levelString,10) * 100 / parseInt(baseLevel,10);
                    this.setState('ink_' + ink[i].state, {val: level, ack: true});
                    this.log.debug(ink[i].name + ' Level: ' + level + '%');
                }

                this.log.debug('Channels and states created/writen');

                // Write connection status
                this.setState('printerInfo.requestResponded', {
                    val: requestResponded,
                    ack: true
                });
                // End request
                this.log.info('Printer data received successfully');
            });
        }).on("error", (error) => {
            this.setState('printerInfo.requestResponded', {
                val: false,
                ack: true
            });
            this.log.error("Error: " + error.message);
        });
    }

    main() {
        const that = this;
        if(this.readSettings()) {
            this.log.debug('Epson XP860 adapter started...');
            this.readPrinter();
        }

        runTimeout = setTimeout(function() {
            that.log.info('Epson XP-860 adapter stopped');
            that.stop();

        }, 10000);
    }

}

// @ts-ignore parent is a valid property on module
if (module.parent) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<ioBroker.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new epson_xp860(options);
} else {
    // otherwise start the instance directly
    new epson_xp860();
}
