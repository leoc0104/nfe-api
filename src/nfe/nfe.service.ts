import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NFeService {
  private parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name) => name === 'det',
  });

  constructor(private prisma: PrismaService) {}

  async findAll(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.nFe.findMany({
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.nFe.count(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const nfe = await this.prisma.nFe.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!nfe) {
      throw new NotFoundException(`NFe with id ${id} not found`);
    }
    return nfe;
  }

  async processXml(file: Express.Multer.File) {
    const parsed = this.parser.parse(file.buffer.toString('utf-8'));

    const nfeProc = parsed.nfeProc ?? parsed;
    const nfe = nfeProc.NFe ?? nfeProc;
    const infNFe = nfe.infNFe;

    if (!infNFe) {
      throw new BadRequestException('Invalid NF-e XML: missing infNFe');
    }

    const rawId: string = infNFe['@_Id'] ?? '';
    const access_key = rawId.replace(/^NFe/, '');

    const ide = infNFe.ide;
    const emit = infNFe.emit;
    const dest = infNFe.dest;
    const total = infNFe.total;
    const det: any[] = Array.isArray(infNFe.det)
      ? infNFe.det
      : [infNFe.det].filter(Boolean);

    const existing = await this.prisma.nFe.findUnique({ where: { access_key } });
    if (existing) {
      throw new ConflictException(`NFe with access key ${access_key} already exists`);
    }

    const nfeRecord = await this.prisma.nFe.create({
      data: {
        access_key,
        number: String(ide.nNF),
        series: String(ide.serie),
        issue_date: new Date(ide.dhEmi ?? ide.dEmi),
        issuer_name: emit.xNome,
        issuer_cnpj: String(emit.CNPJ),
        recipient_name: dest?.xNome ?? '',
        recipient_cnpj: String(dest?.CNPJ ?? dest?.CPF ?? ''),
        total_value: Number(total.ICMSTot.vNF),
        items: {
          createMany: {
            data: det.map((d) => ({
              code: String(d.prod.cProd),
              description: d.prod.xProd,
              ncm: String(d.prod.NCM),
              cfop: String(d.prod.CFOP),
              quantity: Number(d.prod.qCom),
              unit_price: Number(d.prod.vUnCom),
              total_value: Number(d.prod.vProd),
            })),
          },
        },
      },
      include: { items: true },
    });

    return nfeRecord;
  }
}
