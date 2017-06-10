var bodyParser = require('body-parser');
var express    = require('express');
var app        = express();
var mongo      = require('mongodb').MongoClient;
var assert     = require('assert');
var port       = 4000;
var url        = 'mongodb://YOUR_DB_URI_HERE';

app.use(bodyParser.json({limit: '50mb', type:'application/json'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true, parameterLimit:100000,type:'application/x-www-form-urlencoding'}));

var server    = app.listen(port, function() {
    console.log('Chat running on port ' + port + '.');
    //process.send('ready'); // This is only required when using (process manager) pm2, to emit that the app is ready
});
var io        = require('socket.io').listen(server);
var people    = {};

io.sockets.setMaxListeners(20);

io.on('connection', function (socket) {
 console.log('======= a user connected =======');
    socket.on('disconnect', function(){
        console.log(' ++++++++++ a user disconnect ++++++++++ ');
        for (var i in people) {
            if (people[i] == socket.id)
                delete people[i];
        }
        if (io.sockets.connected[socket.id]) {
            io.sockets.connected[socket.id].disconnect();
        }
    });

    // When a user wants to join a specific room
    socket.on('join', function(room) { 
        socket.join(room);
    });

    // Get a name, so we know which users are connected
    socket.on('update-people', function(name) { 
        people[name] = socket.id; 
    });

    // Send the connected names when the client emits `get-people`
    socket.on('get-people', function(data) { 
        io.emit('get-people', people);
    });

    socket.on('send', function(data) {
        io.sockets.in("general").emit('message', data);
        //the message object constists of a string message, a sender id, timestamp using new Date() from client side and a sender name as sender
        var msg = {msg:data.msg, senderId:data.senderId, ts:data.ts, sender:data.sender};
        // Save the sent message to our db, putting it into an array as an object
        mongo.connect(url, function(err, db) {
            assert.equal(null, err);
            db.collection('DBCOLLECTION_NAME').updateOne({"_id": data.room}, { $push: { messages:msg } }, function(err, result) {
                if (err) console.log("ERROR saving", JSON.stringify(err));
                assert.equal(null, err);
                db.close();
            });
        });
    });

    // Another way of getting the sum of connected users but based on their socket id instead of the name
    socket.on('connected-users', function(data) {
        var connected_users = [];
        Object.keys(io.sockets.sockets).forEach(function(id) {
            connected_users.push(id);
        });
        io.emit('connected-users', connected_users.length);
    });

});









