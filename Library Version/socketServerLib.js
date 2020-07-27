var app = require('express')();
var http = require('http').createServer(app);
var hash = require("./sha512/js-sha512/src/sha512.js");

var io = require('socket.io')(http);

var threshold;
var idArray = [];
var trustArr = [];
var p1Id = "";
var sumArr = [];


var conCounter = 0;

var fRandSumCounter = 0;
var frandBinArr = [];
var frandQArr = [];
const {
    performance
} = require('perf_hooks');

app.get('/', (req, res) => {

    res.sendFile(__dirname + '/index.html');

});
app.get('*', (req, res) => {
    res.sendFile(__dirname + req.path);
    console.log("REQ: " + req.path);
});
http.listen(3001, () => {
    console.log('listening on 3001');//http://localhost:3000/
});
function updateThreshold() {//threshold wird neu brechnet mit t = n/2
    threshold = Math.ceil(conCounter / 2);
    if (threshold < 2 || threshold == undefined) {
        threshold = 2;
    }

    console.log(trustArr);
}
io.on('connection', (socket) => {                   //ON CONNECTION
    console.log("id: " + socket.id);
    conCounter++;
    if (!(trustArr.includes(socket.id))) {
        trustArr.push(socket.id);
    }

    io.emit("conUpdate", {//sendet derzeitigen threshold, zahl der parteien (gesammt und vertrauenswürdige) and alle parteien
        trust: trustArr.length,
        threshold: threshold,
        counter: conCounter
    });
    if (!(idArray.includes(socket.id))) {//fügt neue dem ids array hinzu
        idArray.push(socket.id);
    }

    updateThreshold()
    console.log(idArray);
    console.log('connected');

    socket.on('disconnect', () => {                 //ON DISCONNECT
        conCounter--;
        for (var i = 0; i < idArray.length; i++) {
            if (idArray[i] == socket.id) {
                idArray.splice(i, i + 1);
            }
        }
        for (var i = 0; i < trustArr.length; i++) {
            if (trustArr[i] == socket.id) {
                trustArr.splice(i, i + 1);
            }
        }
        io.emit("conUpdate", {//sendet threshold, zahl parteien und zahl vertrauenswürdige parteien
            trust: trustArr.length,
            threshold: threshold,
            counter: conCounter
        });
        updateThreshold()
        console.log('disconnected');
    });
    socket.on('corrupt', () => {
        for (var i = 0; i < trustArr.length; i++) {
            if (trustArr[i] == socket.id) {
                trustArr.splice(i, i + 1);
            }
        }
        updateThreshold();
        io.emit("conUpdate", {//sendet threshold, zahl parteien und zahl vertrauenswürdige parteien
            trust: trustArr.length,
            threshold: threshold,
            counter: conCounter
        });
    });
    socket.on('trust', () => {
        if (!(trustArr.includes(socket.id))) {
            trustArr.push(socket.id);
        }

        updateThreshold();
        io.emit("conUpdate", {//sendet threshold, zahl parteien und zahl vertrauenswürdige parteien
            trust: trustArr.length,
            threshold: threshold,
            counter: conCounter
        });
    });
    //**********************************************DA BIT FUNCTIONS**********************************************
    socket.on('getShares', (data) => {//Jeder wert im array data.input wird in shares aufgeteilt, die zusammenaddiert wieder den wert ergeben
        console.log(idArray);
        var outputArr = [];
        var inputArr = data.input;
        for (var i = 0; i < inputArr.length; i++) {
            var tempShare = genShares(inputArr[i], idArray.length, data.base)
            for (var j = 0; j < idArray.length; j++) {//für jede Partei
                if (outputArr[j] == undefined) {
                    outputArr[j] = [];
                }
                outputArr[j][i] = (tempShare[j]);
            }
        }
        for (var i = 0; i < idArray.length; i++) {//jede Partei erhält einen share
            var dest = "" + data.dest;
            io.to(idArray[i]).emit(dest, outputArr[i]);
        }
        outputArr.length = 0;//array reset
    });
    socket.on('getSum', (data) => {//addiert shares
        var tempArr = [];
        //Sortiert einkommende Objekte in passende paare 
        for (var i = 0; i <= sumArr.length; i++) {
            if (sumArr[i] == undefined) {
                sumArr[i] = [];
                sumArr[i].push({
                    dataObj: data,
                    id: socket.id
                });
                i = sumArr.length + 1;
            } else {
                var mayAdd = true;
                for (var j = 0; j < sumArr[i].length; j++) {
                    if (sumArr[i][j].id == socket.id || sumArr[i][j].dataObj.dest != data.dest) {
                        mayAdd = false;
                    }
                }
                if (mayAdd) {
                    sumArr[i][sumArr[i].length] = ({
                        dataObj: data,
                        id: socket.id
                    });
                    i = sumArr.length + 1;
                }
            }
        }
        for (var i = 0; i < sumArr.length; i++) {
            if (sumArr[i].length >= idArray.length) {
                tempArr = sumArr[i];
                sumArr.splice(i, 1);
            }
        }
       //Addiert passende paare zu einer summe
        if (tempArr.length > 0) {
            var outputArr = []
            for (var i = 0; i < tempArr[0].dataObj.input.length; i++) {
                outputArr[i] = tempArr[0].dataObj.input[i];
                for (var j = 1; j < idArray.length; j++) {
                    outputArr[i] += tempArr[j].dataObj.input[i];
                }
                outputArr[i] = mod(outputArr[i], data.base);
            }

            //sendet summe
            if (data.toP1 == true) {// nur zu p1
                io.to(p1Id).emit(data.dest, outputArr);
            } else {// an alle Parteien
                for (var i = 0; i < idArray.length; i++) {
                    io.to(idArray[i]).emit(data.dest, outputArr);
                }
            }
            tempArr.length = 0;
        }
    });
    socket.on('setp1', (data) => {
        p1Id = socket.id;
    });
    socket.on('setOutputLength', (data) => {
        io.emit('getOutputLength', data);
    });
    //**********************************************FRAND CHECK**********************************************
    socket.on('fRandSum', (data) => {//vergleicht frand Arrays qArr und binArr stellen 
        fRandSumCounter++;
        frandBinArr[frandBinArr.length] = data.binArr;
        frandQArr[frandQArr.length] = data.qArr;
        if (fRandSumCounter >= idArray.length) {
            binSumArr = [];
            qSumArr = [];

            for (var i = 0; i < frandBinArr[0].length; i++) {//erstelt vergleichsarrays aus simme von rij und b 
                binSumArr[i] = frandBinArr[0][i];
                qSumArr[i] = frandQArr[0][i];
                for (var j = 1; j < frandBinArr; j++) {
                    binSumArr[i] += frandBinArr[j][i];
                    qSumArr[i] += frandQArr[j][i];
                }
            }
            var check = true; //ermittelt boolean ergebbnis
            for (var i = 0; i < binSumArr.length; i++) {
                if (qSumArr[i] % 2 != binSumArr[i]) {
                    check = false;
                }

            }
            for (var i = 0; i < idArray.length; i++) {//an alle Parteien
                io.to(idArray[i]).emit("frandResult", {
                    check: check,
                });
            }
            fRandSumCounter = 0;
            frandBinArr.length = 0;
            frandQArr.length = 0;
            sumArr.length = 0;
        }
    });
    socket.on('sendPoint', (data) => {

        io.emit("keyGenPointShare", data);
    });
});

function genShares(x, index, base) {//erstellt shares einer zahl, die addiert wieder die zahl ergeben
    var shares = [];
    var shareSum = 0;
    for (var i = 0; i < index - 1; i++) {
        var tempShare = Math.floor(Math.random() * base);
        shares[i] = tempShare;
        shareSum = mod((shareSum + tempShare), base);
    }
    shares[index - 1] = mod((base - (shareSum - x)), base);
    return shares;
}
function mod(x, mod) {   //normales Javascript modulo funktioniert nicht bei negativen zahlen
    return ((x % mod) + mod) % mod;
}
