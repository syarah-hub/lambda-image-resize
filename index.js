'use strict';

const AWS = require('aws-sdk');

const S3 = new AWS.S3({
    signatureVersion: 'v4',
});
const gm = require('gm').subClass({imageMagick: true});

const BUCKET = process.env.BUCKET;
const URL = process.env.URL;
const WATERMARKLIMIT = process.env.WATERMARKLIMIT;
const ALLOWED_RESOLUTIONS = process.env.ALLOWED_RESOLUTIONS ? new Set(process.env.ALLOWED_RESOLUTIONS.split(/\s*,\s*/)) : new Set([]);

exports.handler = function (event, context, callback) {
    const key = event.queryStringParameters.key;
    const match = key.match(/((\d+)x(\d+))\/(.*)/);
    const isSyarah = key.includes('syarah');
    const watermark = 'new_syarah_watermark_new.png';
    //Check if requested resolution is allowed
    if (0 != ALLOWED_RESOLUTIONS.size && !ALLOWED_RESOLUTIONS.has(match[1])) {
        callback(null, {
            statusCode: '403',
            headers: {},
            body: '',
        });
        return;
    }
    console.log(match);
    // console.log(key);
    // const width = parseInt(match[2], 10);
    const height = parseInt(match[3], 10);
    const originalKey = key.replace('/'+match[1],'');
    const ext = key.split('.')[key.split('.').length - 1];

    S3.getObject({Bucket: BUCKET, Key: originalKey}, (err, data) => {
        if (err) {
            console.error(err);
            return callback(err);
        }
        var imagecont = null;
        if(WATERMARKLIMIT <= height && isSyarah)
        {
             imagecont = gm(data.Body)
                .resize(null, height)
                // WATERMARK - PARAM ORDER: [X Pos, Y Pos, width, height]
                .draw(['gravity Center image Over  0,0 0,0 "'+watermark+'"']).gravity('Center');
        }else {
            imagecont = gm(data.Body)
                .resize(null, height);
        }

        return imagecont
            .quality(100)
            .toBuffer(ext, (err, buffer) => {
                if (err) {
                    console.error(err);
                    return callback(err);
                }
                return S3.putObject({
                    Body: buffer,
                    Bucket: BUCKET,
                    ContentType: 'image/png',
                    Key: key,
                }, (err) => {
                    if (err) {
                        console.error(err);
                        return callback(err);
                    }
                    return callback(null, {
                        statusCode: '301',
                        headers: {'location': `${URL}/${key}`},
                        body: '',
                    });
                });
            });
    });
};



