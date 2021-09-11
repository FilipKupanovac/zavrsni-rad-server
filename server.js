const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const knex = require('knex');

const database = knex({
    client: 'pg',
    connection: {
        host: '127.0.0.1', 
        user: 'postgres',
        password: 'Cersei11Alfa', 
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

app.get('/car/:vin', (request,response) =>{
    const {vin} = request.params;
    database.select('*').from('cars')
        .where({serial_number: vin})
    .then(cars =>{
        if(cars.length){
            response.json(cars[0])
        }
        else{
            response.status(400).json("no matching car found")
        }
    })
    .catch(err => response.status(400).json("Error - no matching car found"))
})

app.get('/previous-appointments/:id/:pendingreq', (req,res) =>{
    const {id} = req.params;
    const pending_req=req.params.pendingreq;
    
    database.select('*').from('cars')
    .join('appointments', 'appointments.serial_number','cars.serial_number')
    .select('*')
    .where({owner_id:id}).andWhere({pending_request: pending_req})
    .andWhere({pending:'Y', made_order: 'N',resolved: 'N'})
    .orderBy('scheduled_time')
    .then(data => {
        res.json(data)
    })
    .catch(err=> res.status(400).json(err))
})
app.get(`/appointments-inprogress/:id`,(req,res) =>{
    const{id} = req.params;

    database.select('*').from('appointments')
        .join('cars','appointments.serial_number','cars.serial_number')
        .join('diagnostic_codes','diagnostic_codes.code','appointments.code')
        .select('*')
        .where({owner_id: id}).andWhere('appointments.code','!=','null')
        .andWhere({resolved: 'N',pending:'N',pending_request:'N'})
        .orderBy('scheduled_time')
    .then(data=>{
        res.json(data)
    })
    .catch(err => res.status(400).json(err))
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
        .orderBy('scheduled_time')
    .then(data => res.json(data))
})

app.get('/awaiting-diagnostics/:id', (req,res) =>{
    let {id} = req.params;
    database.select('*').from('appointments')
        .where({mechanic:id}).andWhere('pending_request','=','N')
        .andWhere('pending','=','Y')
        .orderBy('scheduled_time')
    .then(data => res.json(data))
})

app.get('/diagnostics-inprogress/:id', (req,res) =>{
    let {id} = req.params;
    database.select('*').from('appointments')
        .where({mechanic:id}).andWhere('pending_request','=','N')
        .andWhere('pending','=','N')
        //test row
        /* .andWhere('made_order', '=','N') */.andWhere('resolved','=','N')
        .orderBy('scheduled_time')
    .then(data => res.json(data))
})

app.get('/resolved-appointments/:id', (req,res) =>{
    let {id} = req.params;
    database.select('*').from('appointments')
        .join('cars','cars.serial_number','appointments.serial_number')
        .join('diagnostic_codes','diagnostic_codes.code','appointments.code')
        .where('resolved','=','Y')
        .orderBy('scheduled_time')
    .then(data => res.json(data))
})

app.get('/diagnostic-code/:code', (req,res) =>{
    let {code} = req.params;
    database.select('*').from('diagnostic_codes')
        .whereRaw(`lower(code) like lower('${code}')`)
    .then(data =>{
        if(data.length){
            res.json(data[0])
        }
        else
            res.status(404).json("Code not found")
    })
})

app.get('/parts/:servicepart/:brand', (req,res) =>{
    let servicePart = req.params.servicepart;
    let brand = req.params.brand;
    database.select('*').from('spare_parts')
        .where({service_part : servicePart})
        .andWhereRaw(`lower(compatible_with) like lower('%${brand}%')`)
    .then(data => res.json(data))
    .catch(err => res.json(err))
})


app.get(`/get-part-ean/:ean`,(req,res) =>{
    let {ean} = req.params;
    database.select('*').from('spare_parts')
        .where('ean','=', ean)
    .then(data => res.json(data[0]))
})

app.get(`/resolved-driver/:id`, (req,res)=>{
    let {id} = req.params;
    database.select('*').from('cars')
        .join('appointments','appointments.serial_number','cars.serial_number')
        .join('diagnostic_codes','diagnostic_codes.code','appointments.code')
        .join('users','appointments.mechanic','users.id')
        .where('cars.owner_id','=', id).andWhere({resolved:'Y'})
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
    const {email, name, password, vcode, checkboxState} = request.body;
    if(checkboxState === "true" && vcode !=="authorized")
        response.status(400).json("Wrong mechanic validation code.")
    else
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

    database.insert({
        scheduled_time: date,
        mechanic : mechanic,
        serial_number : vehicle,
        note: note!==undefined ? (note!==""? note: null): null,
        pending: 'Y',
        pending_request: 'Y',
        resolved: 'N',
        made_order: 'N'
    })
    .into('appointments')
    .returning('*')
    .then(res =>{
        response.json(res)
    })
    .catch(err => {response.status(400).json(err)})
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

    database('appointments').where({appointment_number})
    .update({
        scheduled_time: date,
        pending_request: 'N'
    })
    .returning('*')
    .then(data => res.json(data))
    .catch(err => res.status(400).json(err))
})
app.put(`/resolve-diagnostic`, (req,res) =>{
    let {appointment_number, code} = req.body;
    let servicePart;
    switch(code){
        case "P0000": servicePart=null; break;
        case "P0003": servicePart="Fuel pump"; break;
        case "P0148": servicePart="Fuel pump"; break;
        case "P02A1": servicePart="Injector nozzle"; break;
        case "P070F": servicePart="Transmission fluid"; break;
        case "C0760": servicePart="Tyre pressure sensor"; break;
        case "C0127": servicePart="Brake fluid"; break;
        case "B0020": servicePart="Airbag control unit"; break;
    }
    
    database('appointments').where('appointment_number','=', appointment_number)
    .update({pending: 'N', code: code, service_part: servicePart})
    .returning('*')
    .then(data => res.json(data))
})

app.put(`/end-service`, (req,res) =>{
    let {appointment_number, service_note} = req.body;
    database('appointments').where('appointment_number','=',appointment_number)
        .update({resolved: 'Y', service_note: service_note})
    .returning('*')
    .then(data => res.json(data[0]))
})

app.put(`/order-part`,(req,res)=>{
    let {appointment_number, ean} = req.body;
    database('appointments').where('appointment_number','=',appointment_number)
        .update({made_order : 'Y', ean: ean})
        .returning('*')
    .then(data => res.json(data[0]))
})
//#endregion

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

//#region development

//#endregion