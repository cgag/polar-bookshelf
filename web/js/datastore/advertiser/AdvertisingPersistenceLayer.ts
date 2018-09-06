import {IListenablePersistenceLayer, IPersistenceLayer, PersistenceLayerEvent, PersistenceLayerListener} from '../PersistenceLayer';
import {DocMetaFileRef, DocMetaRef} from '../DocMetaRef';
import {DocMeta} from '../../metadata/DocMeta';
import {AdvertisementType, DocInfoAdvertisement} from './DocInfoAdvertisement';
import {DocInfoAdvertiser} from './DocInfoAdvertiser';
import {Reactor} from '../../reactor/Reactor';
import {DeleteResult} from '../DiskDatastore';

export class AdvertisingPersistenceLayer implements IListenablePersistenceLayer {

    public readonly stashDir: string;

    public readonly logsDir: string;

    private readonly worker: Worker;

    /**
     * A PersistenceLayer for the non-dispatched methods (for now).
     */
    private readonly persistenceLayer: IPersistenceLayer;

    private readonly reactor = new Reactor<PersistenceLayerEvent>();

    constructor(worker: Worker, persistenceLayer: IPersistenceLayer) {
        this.worker = worker;
        this.persistenceLayer = persistenceLayer;
        this.stashDir = this.persistenceLayer.stashDir;
        this.logsDir = this.persistenceLayer.logsDir;
    }

    public async contains(fingerprint: string): Promise<boolean> {
        return this.persistenceLayer.contains(fingerprint);
    }

    public getDocMetaFiles(): Promise<DocMetaRef[]> {
        return this.persistenceLayer.getDocMetaFiles();
    }

    public delete(docMetaFileRef: DocMetaFileRef): Promise<DeleteResult> {
        const result = this.persistenceLayer.delete(docMetaFileRef);

        DocInfoAdvertiser.send({docInfo: docMetaFileRef.docInfo, advertisementType: 'deleted'});

        return result;
    }

    public async getDocMeta(fingerprint: string): Promise<DocMeta | undefined> {
        return await this.persistenceLayer.getDocMeta(fingerprint);
    }

    public async init(): Promise<void> {
        return this.persistenceLayer.init();
    }

    public async syncDocMeta(docMeta: DocMeta): Promise<void> {
        return await this.sync(docMeta.docInfo.fingerprint, docMeta);
    }

    public async sync(fingerprint: string, docMeta: DocMeta) {

        const result = this.persistenceLayer.sync(fingerprint, docMeta);

        let advertisementType: AdvertisementType;

        if (this.contains(fingerprint)) {
            advertisementType = 'updated';
        } else {
            advertisementType = 'created';
        }

        DocInfoAdvertiser.send({docInfo: docMeta.docInfo, advertisementType});

        return result;

    }

    public addEventListener(listener: PersistenceLayerListener): void {
        this.reactor.addEventListener('event', listener);
    }

}