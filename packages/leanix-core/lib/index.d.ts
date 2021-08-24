/// <reference types="node" />
import { ReadStream } from 'fs';
export declare type LeanIXHost = string;
export declare type LeanIXApiToken = string;
export declare type BearerToken = string;
export declare type LeanIXWorkspaceId = string;
export declare type LeanIXWorkspaceName = string;
export declare type CustomReportProjectBundle = ReadStream;
export declare type ReportId = string;
export declare type ReportName = string;
export declare type ReportTitle = string;
export declare type ReportVersion = string;
export declare type ReportDescription = string;
export declare type ReportAuthor = string;
export declare type ReportDocumentationLink = string;
export declare type ReportConfig = object;
interface LeanIXCredentials {
    host: LeanIXHost;
    apitoken: LeanIXApiToken;
}
interface AccessToken {
    accessToken: BearerToken;
    expired: boolean;
    expiresIn: number;
    scope: string;
    tokenType: string;
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
export declare const validateCredentials: (host: string | undefined, apitoken: string | undefined) => LeanIXCredentials;
export declare const getAccessToken: (credentials: LeanIXCredentials) => Promise<AccessToken>;
export declare const getLaunchUrl: (devServerUrl: string, bearerToken: BearerToken) => string;
export declare const createBundle: (metadata: CustomReportMetadata, outDir: string) => Promise<CustomReportProjectBundle>;
export declare enum ResponseStatus {
    OK = "OK",
    ERROR = "ERROR"
}
interface ReportUploadResponseData {
    type: string;
    status: ResponseStatus;
    data: {
        id: ReportId;
    };
}
export declare const uploadBundle: (bundle: CustomReportProjectBundle, bearerToken: BearerToken) => Promise<ReportUploadResponseData>;
export declare const fetchWorkspaceReports: (bearerToken: BearerToken) => Promise<CustomReportMetadata[]>;
export declare const deleteWorkspaceReportById: (reportId: ReportId, bearerToken: BearerToken) => Promise<number>;
export {};
