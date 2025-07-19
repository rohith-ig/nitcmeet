const {Client} = require('pg');

const client = new Client({
    user: 'admin',
    host: 'localhost',
    database: 'nitcmeet',
    port: 5432
});


run = async () => {
    try {
        await client.connect();
        await client.query(`insert into test(name) values($1)`,["RO"])
        a = await client.query("select * from test")
        console.log(a.rows);
        await client.query('drop table test')
    }
    catch (e) {
        console.log(e)
    }
}

run();