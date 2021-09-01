const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const knex = require('knex');

const database = knex({
    client: 'pg',
    connection: {
        host: '127.0.0.1', //modify this, localhost=127.0.0.1
        user: 'postgres',
        password: 'Cersei11Alfa', //can be left blank while initializing
        database: 'zavrsni-rad-db'
    }
});

const app = express();
app.use(bodyParser.json());
app.use(cors());

//#region get
app.get('/', (request, response) =>{
    response.send({status: "Connected"})
})

app.get('/cars/:id', (request,response) =>{
    const {id} = request.params;
    database.select('*').from('cars')
        .where({owner_id: id})
    .then(cars =>{
        if(cars.length){
            response.json(cars)
        }
        else{
            response.status(400).json("no matching car found")
        }
    })
    .catch(err => response.status(400).json("Error - no matching car found"))
})

app.get('/previous-appointments/:id', (req,res) =>{
    const {id} = req.params;
    
    database.select('*').from('cars')
    .join('appointments', 'appointments.serial_number','cars.serial_number')
    .select('*')
    .where({owner_id:id})
    .orderBy('scheduled_time')
    .then(data => {
        res.json(data)
    })
    .catch(err=> res.status(400).json(err))
})

app.get('/mechanics/:input', (req,res) => {
    let {input} = req.params;
    database.select('*').from('users')
        .whereRaw(`lower(name) like lower('%${input}%')`)
        .andWhere('type','=', 'mech')
        .then(data => res.json(data))
})

app.get('/appointment-approvals/:id', (req,res) =>{
    let {id} = req.params;
    database.select('*').from('appointments')
        .where({mechanic:id}).andWhere('pending_request','=','Y')
        //test
        .orderBy('scheduled_time')
    .then(data => res.json(data))
})

app.get('/awaiting-diagnostics/:id', (req,res) =>{
    let {id} = req.params;
    database.select('*').from('appointments')
        .where({mechanic:id}).andWhere('pending_request','=','N')
        .andWhere('pending','=','Y')
    .then(data => res.json(data))
})
//#endregion

//#region post
app.post('/signin', (request, response) => {
    database.select('email', 'password').from('users')
        .where('email', '=', request.body.email)
        .then(data => {
            const isValid = (request.body.password.normalize() === data[0].password.normalize())
            if(isValid){
                return database.select('*').from('users')
                    .where('email', '=', request.body.email)
                    .then(user => {
                        response.json(user[0])
                    })
                    .catch(err => response.status(400).json('unable to get user'))
            } else
            res.status(400).json('wrong credentials')
        })
        .catch(err => response.status(400).json('wrong credentials'))
})

app.post('/register', (request, response) => {
    const {email, name, password, vcode} = request.body;

    database.insert({
        password: password,
        email: email,
        name: name,
        joined: new Date(),
        type: (vcode === 'authorized' ? 'mech' : 'driv')
    })
    .into('users')
    .returning('*')
    .then( res => {
        response.json(res[0])
    })
    .catch(err => response.status(400).json(err))
})

app.post(`/request-schedule`, (request,response) =>{
    let {mechanic,vehicle,date,note} = request.body;

    //PARSING DATE AND CORRECT CHOOSING
    date = new Date(date)
    date.setHours(4,0,0)
    let dateCheck = new Date();
    if(date < dateCheck)
    {
        date = dateCheck;
    }
    else{
        dateCheck.setDate(dateCheck.getDate()+60)
        if(date > dateCheck){
            date = dateCheck;
        }
    }
    date.setHours(6,0,0);
    //END OF DATE ASSIGNING

    database.insert({
        scheduled_time: date,
        is_diagnostic : 'Y',
        mechanic : mechanic,
        serial_number : vehicle,
        note: note!==undefined ? (note!==""? note: null): null,
        pending: 'Y',
        pending_request: 'Y'
    })
    .into('appointments')
    .returning('*')
    .then(res =>{
        response.json(res)
    })
    .catch(err => {response.status(400).json("Bad Request. ", err)})
})

app.post(`/add-vehicle`, (req,res)=>{
    const {drivetrain,horsepower,id,license,manufacturer,model,serial,year}=req.body;
    database.insert({
        drivetrain: drivetrain,
        horsepower: horsepower,
        owner_id: id,
        license_plate: license,
        manufacturer: manufacturer,
        model: model,
        serial_number: serial,
        year: year
    })
    .into('cars')
    .returning('*')
    .then(data => res.json(data))
    .catch(err => res.status(400).json(err))
})
//#endregion
//#region put
app.put('/approve-appointment', (req,res)=>{
    let {appointment_number, date} = req.body;
    //PARSING DATE AND CORRECT CHOOSING
    date = new Date(date)
    date.setHours(4,0,0)
    let dateCheck = new Date();
    if(date < dateCheck)
    {
        date = dateCheck;
    }
    else{
        dateCheck.setDate(dateCheck.getDate()+60)
        if(date > dateCheck){
            date = dateCheck;
        }
    }
    date.setHours(6,0,0);
    //END OF DATE ASSIGNING
    database('appointments').where({appointment_number})
    .update({
        scheduled_time: date,
        pending_request: 'N'
    })
    .returning('*')
    .then(data => res.json(data))
    .catch(err => res.status(400).json(err))
})
//#endregion
app.put('/image', (req, res) => {
    const {id} = req.body;
    database('users').where('id', '=', id)
    .increment('entries', 1)
    .returning('entries')
    .then(entries => {
        res.json(entries[0])
    })
    .catch(err=> res.status(400).json('unable to get entries'))
})

app.listen(3000, () => {
    console.log("App is running on port 3000.\nlistening...")
})

//#region delete
app.delete('/reject-appointment/:id', (req,res) =>{
    let {id} = req.params;
    database('appointments').where('appointment_number', '=', id)
    .del()
    .then(data => res.json(data))
})
//#endregion


