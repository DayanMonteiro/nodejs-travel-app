import nodemailer from "nodemailer";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { dayjs } from "../lib/dayjs";
import { getMailClient } from "../lib/mail";
import { ClientError } from "../errors/client-error";

export async function confirmTrip(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    "/trips/:tripId/confirm",
    {
      schema: {
        params: z.object({
          tripId: z.string().uuid(),
        }),
      },
    },
    async (request, reply) => {
      const { tripId } = request.params;

      const trip = await prisma.trip.findUnique({
        where: {
          id: tripId,
        },
        include: {
          participants: {
            where: {
              is_owner: false,
            },
          },
        },
      });

      if (!trip) {
        throw new ClientError("Trip not found.");
      }

      if (trip.is_confirmed) {
        return reply.redirect(`http://localhost:3000/trips/${tripId}`);
      }

      await prisma.trip.update({
        where: { id: tripId },
        data: { is_confirmed: true },
      });

      const formatedStartDate = dayjs(trip.starts_at).format("LL");
      const formatedEndDate = dayjs(trip.ends_at).format("LL");

      const mail = await getMailClient();

      await Promise.all(
        trip.participants.map(async (participant) => {
          const confirmationLink = `http://localhost:3333/participants/${participant.id}/confirm`;
          const message = await mail.sendMail({
            from: {
              name: "Equipe plann.er",
              address: "email@planm.er",
            },
            to: participant.email,

            subject: `Confirme sua presença na viagem para ${trip.destination} em ${formatedStartDate}`,
            html: `
                <div style="font-family: sans-serif; font-size: 16px; line-height: 1.6">
                    <p>
                        Você foi convidado para participar de uma viagem para <b>${trip.destination}</b> nas datas de <b>${formatedStartDate}<b/> a <b>${formatedEndDate}</b> 
                    </p>
                    <br />
                    <p>Para confirmar sua presença na viagem, clique no link abaixo:</p>
                    <br />
                    <p>
                    <a href="${confirmationLink}" >Confirmar viagem:</a>
                    </p>
        
                    <br />
                    <p>Caso esteja usando o dispositivo móvel, você também pode confirmar a criação da viagem pelos aplicativos:</p>
                    <br />
                    <p>Aplicativo para iphone</p>
                    <p>Aplicativo para android</p>
                    <br />
                    <p>Caso você não saiba do que se trata esse e-mail, apenas ignore esse e-mail.</p>
                </div>
                `.trim(),
          });

          console.log(nodemailer.getTestMessageUrl(message));
        })
      );

      return reply.redirect(`http://localhost:3000/trips/${tripId}`);
    }
  );
}
