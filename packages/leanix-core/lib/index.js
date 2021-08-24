"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteWorkspaceReportById = exports.fetchWorkspaceReports = exports.uploadBundle = exports.ResponseStatus = exports.createBundle = exports.getLaunchUrl = exports.getAccessToken = exports.validateCredentials = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
const jwt_decode_1 = __importDefault(require("jwt-decode"));
const form_data_1 = __importDefault(require("form-data"));
const tar_1 = require("tar");
const path_1 = require("path");
const fs_1 = require("fs");
const url_1 = require("url");
const snakeToCamel = (s) => s.replace(/([-_]\w)/g, g => g[1].toUpperCase());
const validateCredentials = (host, apitoken) => {
    if (host === undefined)
        host = '';
    if (apitoken === undefined)
        apitoken = '';
    const credentials = { host, apitoken };
    const validationErrors = [];
    Object.entries(credentials)
        .forEach(([key, value]) => { if (value === undefined)
        validationErrors.push(`${key} is not defined`); });
    if (validationErrors.length > 0)
        throw Error(`Invalid credentials: ${validationErrors.join(', ')}`);
    return credentials;
};
exports.validateCredentials = validateCredentials;
const getAccessToken = async (credentials) => {
    const uri = `https://${credentials.host}/services/mtm/v1/oauth2/token?grant_type=client_credentials`;
    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from('apitoken:' + credentials.apitoken).toString('base64')}`
    };
    const accessToken = await node_fetch_1.default(uri, { method: 'post', headers })
        .then(async (res) => await res.json())
        .then(accessToken => Object.entries(accessToken)
        .reduce((accumulator, [key, value]) => ({ ...accumulator, [snakeToCamel(key)]: value }), {
        accessToken: '',
        expired: false,
        expiresIn: 0,
        scope: '',
        tokenType: ''
    }));
    return accessToken;
};
exports.getAccessToken = getAccessToken;
const getLaunchUrl = (devServerUrl, bearerToken) => {
    const decodedToken = jwt_decode_1.default(bearerToken);
    const urlEncoded = devServerUrl === decodeURIComponent(devServerUrl) ? encodeURIComponent(devServerUrl) : devServerUrl;
    const baseLaunchUrl = `${decodedToken.instanceUrl}/${decodedToken.principal.permission.workspaceName}/reporting/dev?url=${urlEncoded}#access_token=${bearerToken}`;
    return baseLaunchUrl;
};
exports.getLaunchUrl = getLaunchUrl;
const createBundle = async (metadata, outDir) => {
    const metaFilename = 'lxreport.json';
    const bundleFilename = 'bundle.tgz';
    const targetFilePath = path_1.resolve(outDir, bundleFilename);
    console.log('OUTDIR', outDir);
    if (!fs_1.existsSync(outDir))
        throw Error(`could not find outDir: ${outDir}`);
    fs_1.writeFileSync(path_1.resolve(outDir, metaFilename), JSON.stringify(metadata));
    await tar_1.c({ gzip: true, cwd: outDir, file: targetFilePath, filter: path => path !== bundleFilename }, fs_1.readdirSync(outDir));
    const bundle = await fs_1.createReadStream(targetFilePath);
    return bundle;
};
exports.createBundle = createBundle;
var ResponseStatus;
(function (ResponseStatus) {
    ResponseStatus["OK"] = "OK";
    ResponseStatus["ERROR"] = "ERROR";
})(ResponseStatus = exports.ResponseStatus || (exports.ResponseStatus = {}));
const uploadBundle = async (bundle, bearerToken) => {
    const decodedToken = jwt_decode_1.default(bearerToken);
    const url = `${decodedToken.instanceUrl}/services/pathfinder/v1/reports/upload`;
    const headers = { Authorization: `Bearer ${bearerToken}` };
    const form = new form_data_1.default();
    form.append('file', bundle);
    const reportResponseData = await node_fetch_1.default(url, { method: 'post', headers, body: form })
        .then(async (res) => await res.json());
    return reportResponseData;
};
exports.uploadBundle = uploadBundle;
const fetchWorkspaceReports = async (bearerToken) => {
    const decodedToken = jwt_decode_1.default(bearerToken);
    const headers = { Authorization: `Bearer ${bearerToken}` };
    const fetchReportsPage = async (cursor = null) => {
        const url = new url_1.URL(`${decodedToken.instanceUrl}/services/pathfinder/v1/reports?sorting=updatedAt&sortDirection=DESC&pageSize=100`);
        if (cursor !== null)
            url.searchParams.append('cursor', cursor);
        const reportsPage = await node_fetch_1.default(url, { method: 'get', headers })
            .then(async (res) => await res.json());
        return reportsPage;
    };
    const reports = [];
    let cursor = null;
    do {
        const reportResponseData = await fetchReportsPage(cursor);
        if (reportResponseData.status !== ResponseStatus.OK)
            return await Promise.reject(reportResponseData);
        reports.push(...reportResponseData.data);
        cursor = reports.length < reportResponseData.total ? reportResponseData.endCursor : null;
    } while (cursor !== null);
    return reports;
};
exports.fetchWorkspaceReports = fetchWorkspaceReports;
const deleteWorkspaceReportById = async (reportId, bearerToken) => {
    const decodedToken = jwt_decode_1.default(bearerToken);
    const headers = { Authorization: `Bearer ${bearerToken}` };
    const url = new url_1.URL(`${decodedToken.instanceUrl}/services/pathfinder/v1/reports/${reportId}`);
    const status = await node_fetch_1.default(url, { method: 'delete', headers })
        .then(({ status }) => status);
    return status === 204 ? await Promise.resolve(status) : await Promise.reject(status);
};
exports.deleteWorkspaceReportById = deleteWorkspaceReportById;
//# sourceMappingURL=index.js.map