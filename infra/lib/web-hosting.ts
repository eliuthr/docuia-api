import { RemovalPolicy } from 'aws-cdk-lib';
import {
  Distribution,
  PriceClass,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
} from 'aws-cdk-lib/aws-s3';
import {
  BucketDeployment,
  ISource,
  Source,
} from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

const INDEX_DOCUMENT = 'index.html';
/** El cliente web lo lee al arrancar para saber la URL de la API (ver docuia-web/src/main.ts). */
export const RUNTIME_CONFIG_FILE = 'config.json';
/**
 * CloudFront no tiene permiso para listar el bucket, así que S3 responde 403
 * (no 404) a un archivo que no existe. En los dos casos se sirve index.html y
 * el router de Angular resuelve la ruta (por ejemplo, /documents/123).
 */
const SPA_FALLBACK_STATUSES = [403, 404];
/** Un solo patrón cuenta como una ruta: muy lejos de las 1000 gratuitas al mes. */
const INVALIDATE_EVERYTHING = '/*';

/** Configuración que el cliente web recibe en `config.json`. */
export interface WebRuntimeConfig {
  apiBaseUrl: string;
}

/**
 * El cliente web: un bucket privado con el build de Angular y una distribución
 * de CloudFront con HTTPS delante, que es la única que puede leer el bucket (OAC).
 */
export class WebHosting extends Construct {
  readonly distribution: Distribution;
  /** Origen del cliente web (`https://xxxx.cloudfront.net`), para CORS en la API. */
  readonly origin: string;
  private readonly bucket: Bucket;

  constructor(scope: Construct, id: string) {
    super(scope, id);
    // Solo guarda el build, que se regenera en cada despliegue: se borra con el stack.
    this.bucket = new Bucket(this, 'Assets', {
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
    });
    this.distribution = new Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(this.bucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: INDEX_DOCUMENT,
      // Solo Norteamérica y Europa: la clase más barata.
      priceClass: PriceClass.PRICE_CLASS_100,
      errorResponses: SPA_FALLBACK_STATUSES.map((httpStatus) => ({
        httpStatus,
        responseHttpStatus: 200,
        responsePagePath: `/${INDEX_DOCUMENT}`,
      })),
    });
    this.origin = `https://${this.distribution.distributionDomainName}`;
  }

  /**
   * Sube el build junto con `config.json` (que se escribe al desplegar, cuando
   * ya se conoce la URL de la API) e invalida la caché de CloudFront.
   */
  deployContent(assets: ISource, runtimeConfig: WebRuntimeConfig): void {
    new BucketDeployment(this, 'Content', {
      destinationBucket: this.bucket,
      sources: [assets, Source.jsonData(RUNTIME_CONFIG_FILE, runtimeConfig)],
      distribution: this.distribution,
      distributionPaths: [INVALIDATE_EVERYTHING],
    });
  }
}
