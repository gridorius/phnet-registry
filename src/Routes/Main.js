import fs from 'fs';
import PGClient from "../PGClient.js";
import crypto from 'crypto';


let client = new PGClient();

let getProfileName = (PackageName) => {
    let ProfilePackageData = PackageName.split('.', 2);

    return ProfilePackageData.length == 1 ? 'root' : ProfilePackageData[0];
}

export default (app) => {
    /** Return package list */
    app.get('/packages', async (req, resp) => {
        let { rows } = await client.getPackages(req.query.page, req.query.limit);
        let total = await client.getTotal();

        resp.send({
            total,
            items: rows
        });
    });
    
    app.get('/package/:packageId',async (req, resp) => {
        let pack = (await (await client.getPackage(req.params.packageId))).rows[0];
        if(!pack){
            resp.send({
                'error': 'Package not found'
            });
            return;
        }

        if(!pack.IsPublic){
            let key = req.query.key;
            if(!key){
                resp.send({
                    'error': 'Unauthorized'
                });
                return;
            }

            let profileData = {
                ProfileName: getProfileName(pack.PackageName),
                Signature: crypto.createHash('sha512')
                    .update(key)
                    .digest('hex')
            }


            if(!await client.isProfileOwner(profileData)){
                resp.send({
                    'error': 'Not have permission'
                });
                return;
            }
        }

        let readStream = fs.createReadStream(pack.PathToArchive);

        resp.writeHead(200, {
                'Content-Type': 'application/octet-stream',
                'Content-Length': fs.statSync(pack.PathToArchive).size
        });

        readStream.pipe(resp);
        client.addDownload(pack.PackageId);
    });
    
    app.get('/find/package', (req, resp) => {
        client.findPackage(req.query.name, req.query.version).then(res => {
            resp.send(res.rows);
        });
    });
    
    app.post('/add/package', async (req, resp) => {
        let body = req.body;
        let PackageName = body.name;
        let PackageVersion = body.version;
        let IsPublic = body.isPublic ?? true;

        if(!body.password){
            resp.status(400).send({
                error: 'password not settled'
            });
            return;
        }

        let Signature = crypto.createHash('sha512')
        .update(body.password)
        .digest('hex');

        let ProfileName = getProfileName(PackageName);
        let ProfileData = {
            ProfileName,
            Signature
        }

        if(!await client.profileExist(ProfileData))
            client.createProfile(ProfileData)

        if(!await client.isProfileOwner(ProfileData)){
            resp.status(400).send({
                error: 'You are not the owner of the package'
            });
            return;
        }

        let filedata = req.file;
    
        if(!filedata)
            throw new Error('Package data not found')

        let fileName = `${PackageName}_${PackageVersion}.phar`;
        let packageData = {
            PackageName,
            PackageVersion,
            IsPublic,
            PathToArchive: `${filedata.destination}/${fileName}`
        }
    
        fs.rename(`${filedata.destination}/${filedata.filename}`, `${filedata.destination}/${fileName}`, err => {
            if (err) throw new Error(err);
        });
    
        let packageId = await client.registerPackage(packageData);
        resp.send({
            success: true,
            PackageId: packageId
        });
    });
}