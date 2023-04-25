import pg from 'pg';
import fs from 'fs';

export default class PGClient{
    constructor(){
        this.client = new pg.Client({
            host: process.env.PG_HOST ?? 'localhost',
            port: process.env.PG_PORT ?? 5432,
            database: process.env.PG_DATABASE ?? 'postgres',
            password: process.env.PG_PASSWORD ?? 'postgres',
            user: process.env.PG_USER ?? 'postgres'
        });

        this.client.connect();
    }

    upMigration(){
        let query = fs.readFileSync(`${process.cwd()}/src/migrations/main.sql`);
        this.client.query(query.toString(), (err, res) => {
            if(err)
                throw new Error(err);
        });
    }

    async registerPackage(name, version, path){
        let { rows } = await this.client.query(
            `select * from "Packages" where "PackageName" = $1 and "PackageVersion" = $2`, 
            [name, version]
        );

        if(rows.length > 0){
            throw new Error(`Package "${name}" version "${version}" exist`);
            rows.forEach(async row => {
                await this.client.query('delete from "Packages" where "PackageId" = $1', [row.PackageId]);
            });
        }

        return await this.client.query(
            'insert into "Packages" ("PackageName", "PackageVersion", "PathToArchive") VALUES ($1, $2, $3) RETURNING "PackageId"',
            [name, version, path]
        );
    }

    async removePackage(name){
        let { rows } = await this.client.query(
            `select * from "Packages" where "PackageName" = $1`, 
            [name]
        );

        if(rows.length > 0){
            rows.forEach(async row => {
                await this.client.query('delete from "Packages" where "PackageId" = $1', [row.PackageId]);
            });
        }
    }

    async removePackageVersion(name, version){
        let { rows } = await this.client.query(
            `select * from "Packages" where "PackageName" = $1 and "PackageVersion" = $2`, 
            [name, version]
        );

        if(rows.length > 0){
            rows.forEach(async row => {
                await this.client.query('delete from "Packages" where "PackageId" = $1', [row.PackageId]);
            });
        }
    }

    async getPackage(id){
        return await this.client.query(
            'select * from "Packages" where "PackageId" = $1',
            [id]
        );
    }

    async getPackages(PackageName = null, PackageVersion = null){
        let filter = {
            PackageName,
            PackageVersion
        }

        let where = [];
        let parameters = [];
        let findex = 1;

        for(let key in filter){
            if(filter[key]){
                switch(key){
                    case 'PackageVersion':
                        where.push(`"${key}" like $${findex++}`);
                        parameters.push(filter[key].replace('*', '%'));
                        break;
                    default:
                        where.push(`"${key}" = $${findex++}`);
                        parameters.push(filter[key]);
                }
            }  
        }

        return await this.client.query(
            `select "PackageId", "PackageName", "PackageVersion", "Created" from "Packages"`
            + (where.length > 0 ? ` where ${where.join(' and ')}` : ''),
            parameters
        );
    }
}