import elliptic from "./indutnyElliptic/elliptic/dist/elliptic"
var ec = new elliptic.eddsa('ed25519');
var id;//socket id
var q1;//number of valid parties 
var pk;//public key
var sk; //secret key


var q = 116;//107;
var keyPair;

var t0,t1,t2,t3,t4,t5,t6,t7;//zeitmessung


var delta; 
var binResult = [];
var qResult = [];
var socket = io();
var kiArr = [];
var daRepeats = 100;
var daOutputLength;
var sec = 128;
var bArr = [];
var currentMsg = "";


window.onload = function () {
    document.getElementById("keygen").addEventListener("click", function () {
        keyGen();
    });
    document.getElementById("sign").addEventListener("click", function () {
        sign();
    });
    document.getElementById("vrfy").addEventListener("click", function () {
        verify();
    });
    document.getElementById("daBit").addEventListener("click", function () {
        daBit(256);
    });
    document.getElementById("test").addEventListener("click", function () {
        test();
    });
    document.getElementById("corrupt").addEventListener("click", function () {
        corrupt();
    });
    document.getElementById("trustworthy").addEventListener("click", function () {
        trustworthy();
    });
}

socket.on("init", function (data) {

    console.log(data.id);
    id = data.id;

});

socket.on("conUpdate", function (data) {

    var thresholdP = document.getElementById("threshold");
    q1 = data.counter;
    delta = Math.floor(q / 3);//kleinste gruppe mit P1 = 3
    thresholdP.innerHTML = "Threshold: " + data.threshold + "<br>"+data.trust+" Parteien von "+data.counter+" sind vertrauenswürdig.";
    if (data.trust <= data.threshold) {//daBit nur möglich, wenn mehr trust. parteien als threshold
        console.log("too small");
        document.getElementById("daBit").disabled = true;
    } else {
        document.getElementById("daBit").disabled = false;
    }
});
function corrupt(){
    document.getElementById("trustStatus").innerHTML="Diese Partei ist korrupt";
    socket.emit("corrupt");
}
function trustworthy(){
    document.getElementById("trustStatus").innerHTML="Diese Partei ist vertrauenswürdig";
    socket.emit("trust");
}


//**********************************************DA BIT FUNCTIONS**********************************************
function daBit(m) { //generiert m random bits über alle parteien verteilt
    document.getElementById("daBit").disabled=true;
    t0 = performance.now();
    console.log("DA BIT FUNKTION");

    daRepeats = m + ((sec + 1) * sec);
    for (var i = 1; i <= daRepeats; i++) { //generiert daRepeats mal random integer von 0 bis (q-1) 
        var bShare = Math.floor(Math.random() * (q));
        bArr[bArr.length] = (bShare);
    }
    socket.emit("setp1"); //setzt p1 als eigene id auf dem server 
    socket.emit("setOutputLength", m);
    socket.emit("getShares", {// teilt input in q1 viele shares 
        input: bArr,
        base: (q),
        dest: "biShares",
    });
    bArr = [];
}
socket.on("getOutputLength", function (data) {
    daOutputLength = data;
});
socket.on("biShares", function (data) {
    console.log("biShares");
    var hijArr = [];
    var inputArr = data;// share von bArr
    for (var i = 0; i < inputArr.length; i++) { //berechnet hij mit formel bij = lij + delta * hij
        var hij = 0;
        var lij = 0;
        var foundLij = false;
        while (!foundLij) {
            hij++;
            lij = mod(inputArr[i] - (delta * hij), q);
            if (lij < delta && lij >= 0) {
                foundLij = true;
                hijArr[i] = (hij);
            }
        }
    }
    socket.emit("getSum", {//sendet input als shares um mit dne shares anderer parteien zu addieren
        input: hijArr,
        base: (q),
        dest: "hijSum",
        toP1: true  //sendet nur an p1
    });
    socket.emit("getShares", {// teilt input in q1 viele shares 
        input: inputArr,
        base: (q),
        dest: "bijShares"
    });
});
socket.on("hijSum", function (data) {   //nur p1 
    console.log("hijSum");
    var inputArr = data;
    for (var i = 0; i < inputArr.length; i++) { //berechnet ki von der formel ki= delta * hij / q wird für binaäre shares benötigt
        kiArr[i] = (delta * inputArr[i]) / q;
    }
});
socket.on("bijShares", function (data) {
    console.log("bijShares");
    socket.emit("getSum", {//sendet input als shares um mit dne shares anderer parteien zu addieren
        input: data,
        base: (q),
        dest: "bijSum",
    });
});
var bijArr = [];
socket.on("bijSum", function (data) {
    console.log("bijSum");
    bijArr[bijArr.length] = data;//speichert bij Shares von allen q1 parteien

    if (bijArr.length >= q1) {//bij shares von allen parteien

        var biOutputArr = bijArr[0].slice();

        for (let i = 0; i < bijArr[0].length; i++) {//addiert bij Shares zusammen
            for (let j = 1; j < bijArr.length; j++) {
                biOutputArr[i] = (biOutputArr[i] + bijArr[j][i]) % q;
            }
        }
        console.log("Result:");
        console.log(biOutputArr);

        qResult = biOutputArr;
        var bi = qResult;
        biOutputArr = [];
        bijArr = [];

        if (kiArr.length >= daRepeats) {//wenn dieser client p1 ist
            var outputArr = [];
            for (let i = 0; i < kiArr.length; i++) {
                outputArr[i] = mod(Math.round(bi[i] - (kiArr[i] * q)), 2);// binäre version von bArr
            }

            socket.emit("getShares", {// teilt input in q1 viele shares 
                input: outputArr,
                base: 2,
                dest: "biBinShares",
            });
        }
    }
});
socket.on("biBinShares", function (data) {
    console.log("biBinShares");
    socket.emit("getShares", {// teilt input in q1 viele shares 
        input: data,
        base: 2,
        dest: "bijBinShares"
    });
});
socket.on("bijBinShares", function (data) {
    console.log("bijBinShares");
    socket.emit("getSum", {//sendet input als shares um mit dne shares anderer parteien zu addieren
        input: data,
        base: 2,
        dest: "bijBinSum"
    });
});
var bijBinArr = [];
socket.on("bijBinSum", function (data) {
    console.log("bijBinSum");
    bijBinArr[bijBinArr.length] = data;

    if (bijBinArr.length >= q1) { //alle parteien
        var biBinOutputArr = bijBinArr[0].slice();

        for (let i = 0; i < bijBinArr[0].length; i++) {// addiert bij Shares zu biBinArr
            for (let j = 1; j < bijBinArr.length; j++) {
                biBinOutputArr[i] = (biBinOutputArr[i] + bijBinArr[j][i]) % 2;
            }

        }
        console.log("BinResult: ");
        console.log(biBinOutputArr);
        binResult = biBinOutputArr;// bArr %2
        biBinOutputArr = [];
        bijBinArr = [];
        fRand();
    }

});
//**********************************************FRAND CHECK**********************************************
function fRand() {
    var rArr = [];
    for (var j = 0; j < sec; j++) {//erstellt Array mit random bits der größe [3][daOutputLength]
        for (var i = 0; i < daRepeats; i++) {
            if (rArr[i] == undefined) {
                rArr[i] = [];
            }
            var r = Math.floor(Math.random() * 2);
            rArr[i][j] = r;
        }
    }
    var binShares = fRandShares(rArr, binResult, 2);
    var qShares = fRandShares(rArr, qResult, q);
    socket.emit("fRandSum", {//sendet beide arrays zum vergleichen
        binArr: binShares,
        qArr: qShares,
    });
}
function fRandShares(rArr, bArr, base) {//erstellt Array mit shares von rArr
    var resultArr = [];
    for (var j = 0; j < sec; j++) {
        for (var i = 0; i < daRepeats; i++) {
            if (resultArr[j] == undefined) {
                resultArr[j] = 0;
            }
            resultArr[j] += (rArr[i][j] * bArr[i]) % base;
            resultArr[j] = resultArr[j] % base;
        }
    }
    return resultArr;
}
socket.on("frandResult", function (data) {
    console.log("RESULT: " + data.check);
    if (data.check) {//check war positiv
        var output = binResult.slice(0, daOutputLength);//kopiert die ersten 256 bits aus binResult
        console.log(output);
        var outputString = "";
        for (let i = 0; i < output.length; i++) {
            outputString += output[i];

        }
        outputString = outputString.replace(",", "");
        keyGen(outputString);
    }
    kiArr = []; //array reset
    binResult = [];
    qResult = [];
    t1 = performance.now();
    console.log("daBit time: " + (t1 - t0) + " millisekunden");
    document.getElementById("daBit").disabled=false;
});


//**********************************************Signature Functions**********************************************
function keyGen(bitString) {           //KEYGEN
    t2 = performance.now();
    console.log("SIGNATUR ALGORITHMUS");
    console.log("bitstring: " + bitString);
    if (bitString == undefined) {//einzelner client ohne daBit
        console.log("String from JS random");
        bitString = [];//secret key
        for (var i = 0; i < 256; i++) {
            bitString += Math.floor(Math.random() * 2);
        }
    } else if (bitString.length == 256) {//MPC bitString von daBit
        console.log("DEFINED from dabit");
    }
    console.log("B: " + bitString);


    bitString =binToHex(bitString);
    keyPair = ec.keyFromSecret(bitString);
    sk = keyPair.getSecret('hex');
    pk = keyPair.getPublic('hex');

  
    console.log(keyPair);
    console.log(pk);
    console.log(sk);

    document.getElementById("sign").disabled = false;
    document.getElementById("sk").innerHTML = "Secret Key: " + sk;
    document.getElementById("pk").innerHTML = "Public Key: " + pk;
    t3 = performance.now();
    console.log("keyGen time: " + (t3 - t2) + " millisekunden");
    gentestArr.push(t3 - t2);
}



function sign() {                           //SIGN**********************************************
    t4 = performance.now();
        console.log("sign");
        currentMsg = document.getElementById("signText").value;//input aus UI

        var sign = keyPair.sign(currentMsg).toHex();

        console.log("Signature:" + sign);
        document.getElementById("vrfySign").value = sign;
        document.getElementById("vrfyMsg").value = currentMsg;
        t5 = performance.now();
        console.log("keyGen time: " + (t5 - t4) + " millisekunden");
        signtestArr.push(t5 - t4);
    }


function verify() {  	                //VERIFY**********************************************
    t6 = performance.now();
    var m = "" + document.getElementById("vrfyMsg").value;
    var sig = "" + document.getElementById("vrfySign").value;

    var vrfyPK = document.getElementById("vrfyPk").value;
    var vrfy;
    if (vrfyPK.length <= 0) {
        vrfyPK = pk;
        vrfy = keyPair.verify(m, sig);
    } else if (vrfyPK.length == 64) {//importierter public key
        try{
        console.log("VERIFY WITH IMPORTED PUBLIC KEY");
        var importKey = ec.keyFromPublic(vrfyPK, 'hex');
        vrfy = importKey.verify(m, sig);
        }catch(e){
            alert("Fehler!");
        }
    } else {
        alert("Imported Public Key not valid!");
    }


    console.log(vrfy);

    var resultDiv = document.getElementById("vrfyResult");
    if (vrfy) {//verified
        resultDiv.innerHTML = "Signature is valid";
        resultDiv.style.backgroundColor = "green";
    } else {  //nicht verified
        resultDiv.innerHTML = "Signature is invalid";
        resultDiv.style.backgroundColor = "red";
    }
    t7 = performance.now();
    console.log("keyGen time: " + (t7 - t6) + " millisekunden");
    vrfytestArr.push(t7 - t6);
}
function mod(x, mod) {   //normales Javascript modulo funktioniert nicht bei negativen zahlen
    return ((x % mod) + mod) % mod;
}
function binToHex(bin){
    console.log(bin.length);
    var output="";
    for (let i = 0; i < bin.length; i+=4) {
        var sub = bin.substring(i,i+4);
        output += ""+parseInt(sub, 2).toString(16);
        
    }
    console.log(output.length);
    return output;
}
var gentestArr =[];
var signtestArr =[];
var vrfytestArr =[];

function test(){
    var chars       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var stringLength = 1000;
    var runs = 1000;
    gentestArr =[];
    signtestArr =[];
    vrfytestArr =[];

    for (let i = 0; i < runs; i++) {
        keyGen();
        var rndString="";
        for (let i = 0; i < stringLength; i++) {
            var rnd= Math.floor(Math.random() * chars.length);
            rndString +=chars[rnd];
        }
        

        document.getElementById("signText").value = rndString;
        sign();
        verify();
    }
    console.log(gentestArr);
    console.log(signtestArr);
    console.log(vrfytestArr);

    var genAv=0;
    var signAv=0;
    var vrfyAv=0;
    for (let i = 0; i < runs; i++) {
        genAv += gentestArr[i];
        signAv+= signtestArr[i];
        vrfyAv+= vrfytestArr[i];

    }
    genAv =genAv/runs;
    signAv =signAv/runs;
    vrfyAv =vrfyAv/runs;
    console.log("--- Durchschnittliche Laufzeit mit  "+runs+" Durchläufen und "+stringLength+" langen Strings ---")
    console.log("keyGen: "+genAv);
    console.log("sign: "+signAv);
    console.log("verify: "+vrfyAv);
    gentestArr =[];
    signtestArr =[];
    vrfytestArr =[];
}
