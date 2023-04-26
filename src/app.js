import express from "express";
import bodyParser from "body-parser";
import multer from 'multer';
import PGClient from "./PGClient.js";
import routes from './Routes/Main.js';


let client = new PGClient();
client.upMigration();
const app = express();

app.use((req, res, next) => {
    try{
        next();
    }catch(er){
        res.send({
            'error': er.message
        }).status(400);
    }
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(multer({dest: process.env.STORAGE_DIR ?? 'src/storage'}).single('package'))
routes(app);

app.listen(80);