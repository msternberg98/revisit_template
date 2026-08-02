// import localforage from "localforage";

// import {
//     CloudStorageEngine,
//     REVISIT_MODE,
//     SequenceAssignment,
//     SnapshotDocContent,
//     StorageObject,
//     StorageObjectType,
//     StoredUser,
// } from "./types";
// import { StageData } from "./types";

// export class UniServerStorageEngine extends CloudStorageEngine {
//     protected _updateAdminUsersList(adminUsers: { adminUsersList: StoredUser[]; }): Promise<void> {
//         throw new Error("Method not implemented.");
//     }
//     changeAuth(bool: boolean): Promise<void> {
//         throw new Error("Method not implemented.");
//     }
//     addAdminUser(user: StoredUser): Promise<void> {
//         throw new Error("Method not implemented.");
//     }
//     removeAdminUser(email: string): Promise<void> {
//         throw new Error("Method not implemented.");
//     }
//     protected _createSequenceAssignment(participantId: string, sequenceAssignment: SequenceAssignment, withServerTimestamp: boolean): Promise<void> {
//         throw new Error("Method not implemented.");
//     }
//     protected _updateSequenceAssignmentFields(participantId: string, updatedFields: Partial<SequenceAssignment>): Promise<void> {
//         throw new Error("Method not implemented.");
//     }
//     protected _getSequenceAssignment(participantId: string): Promise<SequenceAssignment | null> {
//         throw new Error("Method not implemented.");
//     }
//     protected _completeCurrentParticipantRealtime(): Promise<void> {
//         throw new Error("Method not implemented.");
//     }
//     protected _rejectParticipantRealtime(participantId: string): Promise<void> {
//         throw new Error("Method not implemented.");
//     }
//     protected _undoRejectParticipantRealtime(participantId: string): Promise<void> {
//         throw new Error("Method not implemented.");
//     }
//     protected _claimSequenceAssignment(participantId: string, sequenceAssignment: SequenceAssignment): Promise<void> {
//         throw new Error("Method not implemented.");
//     }
//     setMode(studyId: string, mode: REVISIT_MODE, value: boolean): Promise<void> {
//         throw new Error("Method not implemented.");
//     }
//     protected _setModesDocument(studyId: string, modesDocument: Record<REVISIT_MODE, boolean> & { stage?: StageData; }): Promise<void> {
//         throw new Error("Method not implemented.");
//     }
//     protected _getAudioUrl(task: string, participantId?: string): Promise<string | null> {
//         throw new Error("Method not implemented.");
//     }
//     protected _getScreenRecordingUrl(task: string, participantId?: string): Promise<string | null> {
//         throw new Error("Method not implemented.");
//     }
//     protected _testingReset(studyId: string): Promise<void> {
//         throw new Error("Method not implemented.");
//     }
//     protected _directoryExists(path: string): Promise<boolean> {
//         throw new Error("Method not implemented.");
//     }
//     protected _copyDirectory(source: string, target: string): Promise<void> {
//         throw new Error("Method not implemented.");
//     }
//     protected _deleteDirectory(path: string): Promise<void> {
//         throw new Error("Method not implemented.");
//     }
//     protected _copyRealtimeData(source: string, target: string): Promise<void> {
//         throw new Error("Method not implemented.");
//     }
//     protected _deleteRealtimeData(path: string): Promise<void> {
//         throw new Error("Method not implemented.");
//     }
//     protected _addDirectoryNameToSnapshots(directoryName: string, studyId: string): Promise<void> {
//         throw new Error("Method not implemented.");
//     }
//     protected _removeDirectoryNameFromSnapshots(directoryName: string, studyId: string): Promise<void> {
//         throw new Error("Method not implemented.");
//     }
//     protected _changeDirectoryNameInSnapshots(oldName: string, newName: string, studyId: string): Promise<void> {
//         throw new Error("Method not implemented.");
//     }

//     private readonly SERVER_URL = import.meta.env.VITE_SERVER_URL;

//     protected participantStore = localforage.createInstance ({
//         name: "revisit-university",
//     });

//     constructor (testing = false) {

//         super ("server", testing);

//     }

//     async connect () {
//         try {

//             const response = await fetch (
//                 `${this.SERVER_URL}/health`
//             );

//             this.connected = response.ok;

//         } catch {

//             this.connected = false;

//             console.warn ("Study server konnte nicht erreicht werden.");

//         }

//     }

//     async initializeStudyDb (studyId: string) {

//         this.studyId = studyId;

//     }

//     async checkAuthReadiness() {

//         if (!this.connected) {

//             throw new Error (
//                 "Study Server nicht erreichbar."
//             );

//         }
//     }

//     private async request <T> (
//         endpoint: string,
//         options?: RequestInit,
//     ): Promise <T> {

//         console.log("REQUEST:", options?.method ?? "GET", `${this.SERVER_URL}${endpoint}`);

//         const response = await fetch (
//             `${this.SERVER_URL}${endpoint}`,
//             {
//                 headers: {
//                     "Content-Type": "application/json",
//                     ...(options?.headers ?? {}),
//                 },
//                 ...options,
//             },
//         );

//         if (!response.ok) {
//             throw new Error (
//                 `Server request failed: ${response.status} ${response.statusText}`,
//             );
//         }

//         return await response.json() as T;
//     }

//     protected async _createParticipant () {

//         console.log ("Server: create participant");

//         const response = await this.request <{
//             participantId: string;
//         }>(
//             "/participants",
//             {
//                 method: "POST",
//             },
//         );

//         this.currentParticipantId = response.participantId;

//         await this.participantStore.setItem (
//             "currentParticipantId",
//             response.participantId,
//         );

//         return response.participantId;
//     }

//     async login () {
//         return null;
//     }

//     async logout () {
//         return;
//     }

//     unsubscribe () {
//         return () => {};
//     }

//     async getSnapshots () {
//         return {};
//     }

//     async getModes () {
//         return {
//             dataCollectionEnabled: true,
//             developmentModeEnabled: false,
//             dataSharingEnabled: false,
//         };
//     }

//     protected async _pushToStorage <T extends StorageObjectType> (
//         prefix: string,
//         type: T,
//         objectToUpload: StorageObject <T>,
//     ): Promise <void> {

//         if (type !== "participantData") {
//             return;
//         }

//         const participantId = prefix.replace (
//             "participants/",
//             "",
//         );

//         await this.request (
//             `/participants/${participantId}`,
//             {
//                 method: "PUT",
//                 body: JSON.stringify (objectToUpload),
//             },
//         );
//     }

//     protected async _getFromStorage <T extends StorageObjectType> (
//         prefix: string,
//         type: T,
//     ): Promise <StorageObject <T> | null> {

//         if (type !== "participantData") {
//             return null;
//         }

//         const participantId = prefix.replace (
//             "participants/",
//             "",
//         );

//         console.log("participantId:", participantId);

//         try {

//             const response = await this.request<{
//                 participantId: string;
//                 createdAt: string;
//                 data: StorageObject <T>;
//             }>(
//                 `/participants/${participantId}`,
//             );

//             return response.data;

//         } catch (error) {

//             console.log (
//                 "Participant nicht gefunden:",
//                 participantId,
//             );

//             return null;
//         }
//     }

//     protected async _cacheStorageObject () {}

//     protected async _deleteFromStorage () {}

//     protected async _verifyStudyDatabase () {}

//     protected async _setCurrentConfigHash () {}

//     protected async _getCurrentConfigHash () {
//         return null;
//     }
//     async getUserManagementData <T extends "authentication" | "adminUsers"> (
//         key: T,
//     ): Promise <
//         (
//             T extends "authentication"
//                 ? { isEnabled: boolean }
//                 : { adminUsersList: StoredUser [] }
//         ) | undefined
//     > {

//         if (key === "authentication") {
//             return {
//                 isEnabled: false,
//             } as any;
//         }

//         return {
//             adminUsersList: [],
//         } as any;
//     }

//     public async getAllSequenceAssignments (): Promise <SequenceAssignment []> {
//         return [];
//     }
// }
