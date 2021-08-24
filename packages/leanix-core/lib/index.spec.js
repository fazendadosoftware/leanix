"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ava_1 = __importDefault(require("ava"));
const url_1 = require("url");
const path_1 = require("path");
const fs_1 = require("fs");
const tar_1 = require("tar");
const index_1 = require("./index");
require('dotenv').config(); // eslint-disable-line
const { LEANIX_HOST: host, LEANIX_APITOKEN: apitoken } = process.env;
const getDummyReportMetadata = () => ({
    id: 'net.fazendadosoftware.testReport',
    name: 'custom-report-name',
    title: 'Fazenda do Software Test Report',
    version: '0.1.0',
    description: 'Custom Report Description',
    author: 'John Doe',
    documentationLink: 'https://www.google.com',
    defaultConfig: {}
});
const credentials = index_1.validateCredentials(host, apitoken);
ava_1.default('getAccessToken returns a token', async (t) => {
    const accessToken = await index_1.getAccessToken(credentials);
    t.is(typeof accessToken.accessToken, 'string', 'accessToken is a string');
    t.truthy(accessToken.accessToken, 'accessToken is not an empty string');
    t.is(typeof accessToken.expired, 'boolean', 'expired is a boolean');
    t.false(accessToken.expired, 'expired is false');
    t.is(typeof accessToken.expiresIn, 'number', 'expiresIn is a number');
    t.true(accessToken.expiresIn > 0, 'expiresIn is greater than zero');
    t.is(typeof accessToken.scope, 'string', 'scope is a string');
    t.is(accessToken.tokenType, 'bearer', 'tokenType is "bearer"');
    console.log(accessToken.accessToken);
});
ava_1.default('getLaunchUrl returns a url', async (t) => {
    const devServerUrl = 'https://localhost:8080';
    const expectedInstanceUrl = 'https://app.leanix.net';
    const expectedWorkspaceName = 'bernharddemo';
    const bearerToken = 'eyJraWQiOiI0MDJjODg3NTBjZmJhOGQzZTQ0NjE0YzQ5YjBlYzg3NiIsImFsZyI6IlJTMjU2In0.eyJzdWIiOiJwYXVsb0BmYXplbmRhZG9zb2Z0d2FyZS5jb20iLCJwcmluY2lwYWwiOnsiaWQiOiIyN2U0MjQyZS0xNWJiLTRlNDQtYjQxYi1hMDViYzFhMTEyMjIiLCJ1c2VybmFtZSI6InBhdWxvQGZhemVuZGFkb3NvZnR3YXJlLmNvbSIsInJvbGUiOiJBQ0NPVU5UVVNFUiIsInN0YXR1cyI6IkFDVElWRSIsImFjY291bnQiOnsiaWQiOiIzYWZhMjE2YS1hZTMxLTRjOWUtYTcyZi1hOTVjYzE4NDAxMmQiLCJuYW1lIjoiZmF6ZW5kYWRvc29mdHdhcmUifSwicGVybWlzc2lvbiI6eyJpZCI6ImQ0YmI0MTk5LTgxMmEtNDE2Ny05ZTlmLThmMGI3NWYxMTg0NCIsIndvcmtzcGFjZUlkIjoiZDBhMGEwNDQtMGQ5Ny00ZDhiLTllMmQtYzkzYTBiMTdhMWJhIiwid29ya3NwYWNlTmFtZSI6ImJlcm5oYXJkZGVtbyIsInJvbGUiOiJBRE1JTiIsImN1c3RvbWVyUm9sZXMiOm51bGwsImFjY2Vzc0NvbnRyb2xFbnRpdGllcyI6WyJCTFVFIl0sInN0YXR1cyI6IkFDVElWRSIsImFzVXNlciI6bnVsbH19LCJpc3MiOiJodHRwczovL2V1LXN2Yy5sZWFuaXgubmV0IiwianRpIjoiMTkyMGY1NzktMTU5MS00OTE2LTkzZTktYWQ5NWQyZDFkNzNkIiwiZXhwIjoxNjI5NjgwMzYwLCJpbnN0YW5jZVVybCI6Imh0dHBzOi8vYXBwLmxlYW5peC5uZXQifQ.UswqJIfuT6EG5haAt9WiOG8qRBybV62eHqIbvahZK38AafQ93QETVMbYxf3AySSAYtrElpl3N4mZHtfqJTEygVlQw9uxUQioaT6US-lR6DJK0a7HIK-ec7LHtaQXVu2IOEGgrc7frLYFJcL1zoQqxCuxzNGtgngZbVkSKInm5sQXMueTPkew20Km762a11Us0ralnzmXduIB-JGvjt-nrEgl7t7MpRD2wN9WjN-b3Yw-2sDLj8___bcVPChH93P-p6XMRne5hiHmr-JaY3w2HHQ6PLqU2cG1BMdnA6DpmStM8MRVSciBGPtgy0ovbUrxw862wK1na8F2nrFZpsf9dw';
    const launchUrl = index_1.getLaunchUrl(devServerUrl, bearerToken);
    t.is(typeof launchUrl, 'string', 'launchUrl is a string');
    const url = new url_1.URL(launchUrl);
    t.is(url.origin, expectedInstanceUrl, `launchUrl origin is ${expectedInstanceUrl}`);
    t.is(url.pathname, `/${expectedWorkspaceName}/reporting/dev`, `expected path is /${expectedWorkspaceName}/reporting/dev`);
    t.is(url.searchParams.get('url'), devServerUrl, `launchUrl has a query string param url=${devServerUrl}`);
    t.is(url.hash, `#access_token=${bearerToken}`, `launchUrl has a query string param url=${devServerUrl}`);
});
ava_1.default('createProjectBundle returns a readable stream', async (t) => {
    const projectFiles = {
        'index.js': 'console.log("hello world")',
        'index.html': '<html><body>Hello world</body></html>'
    };
    const outDir = path_1.resolve(__dirname, '.temp');
    if (!fs_1.existsSync(outDir))
        fs_1.mkdirSync(outDir, { recursive: true });
    Object.entries(projectFiles)
        .forEach(([filename, content]) => fs_1.writeFileSync(path_1.resolve(outDir, filename), content));
    const expectedMetadata = getDummyReportMetadata();
    const fileStream = await index_1.createBundle(expectedMetadata, outDir);
    const bundleFiles = await new Promise((resolve, reject) => {
        const entries = [];
        fileStream.on('open', () => fileStream.pipe(tar_1.t()).on('entry', entry => entries.push(entry)));
        fileStream.on('error', err => reject(err));
        fileStream.on('end', () => resolve(new Set(entries.map(({ path }) => path))));
    });
    const requiredFiles = new Set([...Object.keys(projectFiles), 'lxreport.json']);
    const bundleHasAllFiles = () => {
        for (const file of requiredFiles)
            if (!bundleFiles.has(file))
                return false;
        return true;
    };
    t.true(bundleFiles.size === requiredFiles.size, `fileStream entries is an array with ${requiredFiles.size} items`);
    t.true(bundleHasAllFiles(), `fileStream has all required files: ${Array.from(requiredFiles).join(', ')}`);
    fs_1.rmdirSync(outDir, { recursive: true });
});
ava_1.default('uploadBundle', async (t) => {
    const outDir = path_1.resolve(__dirname, '.temp');
    const metadata = getDummyReportMetadata();
    if (!fs_1.existsSync(outDir))
        fs_1.mkdirSync(outDir, { recursive: true });
    fs_1.writeFileSync(path_1.resolve(outDir, 'index.html'), '<html><body>Hi from demo project</body></html>');
    fs_1.writeFileSync(path_1.resolve(outDir, 'index.js'), 'console.log("hello world")');
    const accessToken = await index_1.getAccessToken(credentials);
    const reports = await index_1.fetchWorkspaceReports(accessToken.accessToken);
    const hasTestReportInWorkspace = reports.find(({ reportId, version }) => reportId === metadata.id && version === metadata.version);
    if (hasTestReportInWorkspace !== undefined)
        await index_1.deleteWorkspaceReportById(hasTestReportInWorkspace.id, accessToken.accessToken);
    const bundle = await index_1.createBundle(metadata, outDir);
    const reportUploadResponseData = await index_1.uploadBundle(bundle, accessToken.accessToken);
    t.is(reportUploadResponseData.status, 'OK');
    t.is(reportUploadResponseData.type, 'ReportUploadResponseData');
    t.is(typeof reportUploadResponseData.data.id, 'string');
    const status = await index_1.deleteWorkspaceReportById(reportUploadResponseData.data.id, accessToken.accessToken);
    t.is(status, 204);
    fs_1.rmdirSync(outDir, { recursive: true });
});
//# sourceMappingURL=index.spec.js.map