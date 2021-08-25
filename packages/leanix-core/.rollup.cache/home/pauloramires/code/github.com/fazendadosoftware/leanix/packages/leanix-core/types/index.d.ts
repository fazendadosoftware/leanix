/// <reference types="node" />
import { ReadStream } from 'fs';
export { validate, ValidationError } from 'jsonschema';
declare type LeanIXHost = string;
declare type LeanIXApiToken = string;
declare type BearerToken = string;
declare type LeanIXWorkspaceId = string;
declare type LeanIXWorkspaceName = string;
declare type ReportId = string;
declare type ReportName = string;
declare type ReportTitle = string;
declare type ReportVersion = string;
declare type ReportDescription = string;
declare type ReportAuthor = string;
declare type ReportDocumentationLink = string;
declare type ReportConfig = object;
export declare type CustomReportProjectBundle = ReadStream;
export interface LeanIXCredentials {
    host: LeanIXHost;
    apitoken: LeanIXApiToken;
}
export interface AccessToken {
    accessToken: BearerToken;
    expired: boolean;
    expiresIn: number;
    scope: string;
    tokenType: string;
}
export interface JwtClaims {
    exp: number;
    instanceUrl: string;
    iss: string;
    jti: string;
    sub: string;
    principal: {
        permission: {
            workspaceId: LeanIXWorkspaceId;
            workspaceName: LeanIXWorkspaceName;
        };
    };
}
export interface CustomReportMetadata {
    id: ReportId;
    reportId?: ReportId;
    name: ReportName;
    title: ReportTitle;
    version: ReportVersion;
    author: ReportAuthor;
    description: ReportDescription;
    documentationLink: ReportDocumentationLink;
    defaultConfig: ReportConfig;
}
export declare const readLxrJson: (path?: string | undefined) => Promise<LeanIXCredentials>;
export declare const readMetadataJson: (path?: string) => Promise<CustomReportMetadata>;
export declare const getAccessToken: (credentials: LeanIXCredentials) => Promise<AccessToken>;
export declare const getAccessTokenClaims: (accessToken: AccessToken) => JwtClaims;
export declare const getLaunchUrl: (devServerUrl: string, bearerToken: BearerToken) => string;
export declare const createBundle: (metadata: CustomReportMetadata, outDir: string) => Promise<CustomReportProjectBundle>;
interface ReportUploadError {
    value: 'error';
    messages: string[];
}
declare type ResponseStatus = 'OK' | 'ERROR';
export interface ReportUploadResponseData {
    type: string;
    status: ResponseStatus;
    data: {
        id: ReportId;
    };
    errorMessage?: string;
    errors?: ReportUploadError[];
}
export declare const uploadBundle: (bundle: CustomReportProjectBundle, bearerToken: BearerToken) => Promise<ReportUploadResponseData>;
export declare const fetchWorkspaceReports: (bearerToken: BearerToken) => Promise<CustomReportMetadata[]>;
export declare const deleteWorkspaceReportById: (reportId: ReportId, bearerToken: BearerToken) => Promise<204 | number>;
