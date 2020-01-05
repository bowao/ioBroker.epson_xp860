'use strict';

/*
 * Created with @iobroker/create-adapter v1.17.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');

// Load your modules here, e.g.:
const request = require('request');

var lang = 'de';
var ip = '';
var baselevel = 50; // bedeutet: in der Webseite wird ein Balken von 100% Höhe 50px hoch gezeichnet. 
                    // Also entspricht ein gezeigtes Tintenlevel von 25 (px) dann 50% und eines von 10 (px) dann 20%
var link = '';
var ink = {
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
            this.log.info('cleaned everything up...');
            callback();
        } catch (e) {
            callback();
        }
    }

    readSettings() {
        //check if IP is entered in settings
        if (!this.config.printerip) {
            this.log.warn('No IP adress of printer set up. Adapter will be stopped.');
            //stopReadPrinter();
        } 
        else {
            ip = (this.config.printerport.length > 0) ? this.config.printerip + ':' + this.config.printerport : this.config.printerip; // if port is set then ip+port else ip only
            this.log.debug('IP: ' + ip);
            link = 'http://' + ip + '/PRESENTATION/HTML/TOP/PRTINFO.HTML';
            this.setState('printerInfo.ip', {
                val: ip,
                ack: false
            });
        }
    }

    readPrinter() {

        var name_cut = 'Druckername',
            name_cut2 = 'Verbindungsstatus',
            connect_cut = 'Verbindungsstatus',
            connect_cut2 = 'IP-Adresse beziehen',
            model_cut = '<title>',
            model_cut2 = '</title>',
            mac_cut = 'MAC-Adresse',
            mac_cut2 = 'info-wfd',
            requestResponded,
            responseTime
     
        request(
            {
                url: link,
                time: true,
                timeout: 4500
            },
            (error, response, body) => {
                if (!error && response.statusCode == 200) {
                    requestResponded = true;
                    this.setState('printerInfo.ip', {
                        val: ip,
                        ack: true
                    });
                     // NAME EINLESEN
                    var name_cut_position = body.indexOf(name_cut) + name_cut.length + 41,
                    name_cut2_position = body.indexOf(name_cut2) -64;
                    var name_string = body.substring(name_cut_position, name_cut2_position);
                    this.setState('printerInfo.name', {val: name_string, ack: true});  
                
                     // MODELL EINLESEN
                    var model_cut_position = body.indexOf(model_cut) + model_cut.length,
                    model_cut2_position = body.indexOf(model_cut2);
                    var model_string = body.substring(model_cut_position, model_cut2_position);
                    this.setState('printerInfo.model', {val: model_string, ack: true});  
                
                     // MAC ADRESSE EINLESEN
                    var mac_cut_position = body.indexOf(mac_cut) + mac_cut.length + 41,
                    mac_cut2_position = body.indexOf(mac_cut2) - 39;
                    var mac_string = body.substring(mac_cut_position, mac_cut2_position);
                    this.setState('printerInfo.mac', {val: mac_string, ack: true});     
            
                     // CONNECTION EINLESEN
                    var connect_cut_position = body.indexOf(connect_cut) + connect_cut.length + 41,
                    connect_cut2_position = body.indexOf(connect_cut2) - 64;
                    var connect_string = body.substring(connect_cut_position, connect_cut2_position);
                    this.setState('printerInfo.connection', {val: connect_string, ack: true});   

                    for (var i in ink) {
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
                        var cut_position = body.indexOf(ink[i].cut) + ink[i].cut.length + 10;
                        var level_string = body.substring(cut_position, cut_position + 12);
                        var level = parseInt(level_string,10) * 100 / parseInt(baselevel,10);
                        this.setState('ink_' + ink[i].state, {val: level, ack: true});
                        this.log.debug(ink[i].name + ' Level: ' + level + '%');
                    }
                
                    this.log.debug('Channels and states created/write');
                    responseTime = parseInt(response.timingPhases.total);
                
                } else {
                    this.log.warn('Cannot connect to Printer: ' + error);
                    requestResponded = false;
                    responseTime = -1;
                }

                // Write connection status
                this.setState('printerInfo.requestResponded', {
                    val: requestResponded,
                    ack: true
                });
                this.setState('printerInfo.responseTime', {
                    val: responseTime,
                    ack: true
                });
            }
        ); // End request 
            this.log.debug('finished reading printer Data');
    }

    main() {
        const that = this;
        this.readSettings();
        this.log.debug('Epson XP860 adapter started...');
        this.readPrinter();

        setTimeout(function() {
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
