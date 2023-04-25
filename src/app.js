import express from "express";
import bodyParser from "body-parser";
import multer from 'multer';
import PGClient from "./PGClient.js";
import fs from 'fs';

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
app.use(multer({dest: 'src/storage'}).single('package'))


app.get('/packages', (req, resp) => {
    client.getPackages().then(res => {
        resp.send(res.rows);
    });
});

app.get('/package/:packageId', (req, resp) => {
    client.getPackage(req.params.packageId).then(res => {
        let pack = res.rows[0];
        if(!pack){
            resp.send({
                'error': 'Package not found'
            });
            return;
        }
        resp.download(pack.PathToArchive);
    });
})

app.get('/find/package', (req, resp) => {
    client.getPackages(req.query.name, req.query.version).then(res => {
        resp.send(res.rows);
    });
});

app.delete('/package/:name/:version', (req, resp) => {
    client.removePackageVersion(req.params.name, req.params.version).then(res => {
        resp.send({
            success: true
        });
    });
});

app.delete('/package/:name', (req, resp) => {
    client.removePackage(req.params.name).then(res => {
        resp.send({
            success: true
        });
    });
});

app.post('/add/package', (req, resp) => {
    let name = req.query.name;
    let version = req.query.version;
    let filedata = req.file;

    let extensions = {
        'application/x-tar': 'tar',
        'application/gzip': 'tar.gz'
    };

    if(!filedata)
        throw new Error('Package data not found')

    if(!extensions[filedata.mimetype])
        throw new Error(`package type ${filedata.mimetype} not allowed`);

    let fileName = `${name}_${version}.${extensions[filedata.mimetype]}`;
    fs.rename(`${filedata.destination}/${filedata.filename}`, `${filedata.destination}/${fileName}`, err => {
        if (err) throw new Error(err);
    })

    client.registerPackage(name, version, `${process.cwd()}/${filedata.destination}/${fileName}`)
        .then(result => {
            if(result.rows.length > 0)
                resp.send({
                    success: true,
                    PackageId: result.rows[0].PackageId
                });
            else throw new Error('Creation error')
        });
});

app.listen(80);