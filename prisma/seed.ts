import { EnglishLevel, PrismaClient, TopicLevel } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const topics: Array<{ textEn: string; level: TopicLevel }> = [
  { textEn: 'Describe your ideal weekend.', level: 'A2' },
  { textEn: 'What food do you enjoy cooking?', level: 'A2' },
  { textEn: 'Talk about your hometown.', level: 'A2' },
  { textEn: 'What is your daily routine?', level: 'A2' },
  { textEn: 'Describe a person you admire.', level: 'A2' },
  { textEn: 'What makes a good friend?', level: 'A2' },
  { textEn: 'Should people work from home?', level: 'B1' },
  { textEn: 'How can cities become greener?', level: 'B1' },
  { textEn: 'Describe a memorable journey.', level: 'B1' },
  { textEn: 'What is the best way to learn a language?', level: 'B1' },
  { textEn: 'How does social media affect friendships?', level: 'B1' },
  { textEn: 'Should schools teach practical life skills?', level: 'B1' },
  { textEn: 'Is technology making us more productive?', level: 'B2' },
  { textEn: 'What responsibilities do companies have to society?', level: 'B2' },
  { textEn: 'How should tourism balance growth and conservation?', level: 'B2' },
  { textEn: 'Can failure be more useful than success?', level: 'B2' },
  { textEn: 'Should public transport be free?', level: 'B2' },
  { textEn: 'How does culture influence communication?', level: 'B2' },
  { textEn: 'Does artificial intelligence require global regulation?', level: 'C1' },
  { textEn: 'Is economic growth compatible with sustainability?', level: 'C1' },
  { textEn: 'When, if ever, is censorship justified?', level: 'C1' },
  { textEn: 'How does language shape thought?', level: 'C1' },
  { textEn: 'Should governments prioritize equality or opportunity?', level: 'C1' },
  { textEn: 'What defines meaningful progress?', level: 'C1' },
  { textEn: 'Which invention has changed everyday life the most?', level: 'ALL' },
  { textEn: 'What would make your community a better place?', level: 'ALL' },
  { textEn: 'Is it better to plan carefully or be spontaneous?', level: 'ALL' },
  { textEn: 'What skill would you most like to master?', level: 'ALL' },
  { textEn: 'What does a balanced life look like?', level: 'ALL' },
  { textEn: 'Which traditions are important to preserve?', level: 'ALL' },
];

const demoLevels: EnglishLevel[] = ['A2', 'A2', 'B1', 'B1', 'B2', 'B2', 'C1', 'C1'];

async function main(): Promise<void> {
  const existingTopics = new Set(
    (await prisma.topic.findMany({ select: { textEn: true } })).map((topic) => topic.textEn),
  );
  const missingTopics = topics.filter((topic) => !existingTopics.has(topic.textEn));
  if (missingTopics.length) await prisma.topic.createMany({ data: missingTopics });

  const passwordHash = await bcrypt.hash('DemoPass123!', 12);
  for (let index = 0; index < demoLevels.length; index += 1) {
    const number = index + 1;
    await prisma.user.upsert({
      where: { email: `demo${number}@example.com` },
      update: { displayName: `Demo User ${number}`, englishLevel: demoLevels[index]! },
      create: {
        email: `demo${number}@example.com`,
        passwordHash,
        displayName: `Demo User ${number}`,
        englishLevel: demoLevels[index]!,
      },
    });
  }

  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: { displayName: 'Speak Four Admin', role: 'ADMIN', suspendedAt: null },
    create: {
      email: 'admin@example.com',
      passwordHash,
      displayName: 'Speak Four Admin',
      englishLevel: 'C1',
      nativeLanguage: 'English',
      goals: ['community'],
      interests: ['culture', 'technology'],
      role: 'ADMIN',
    },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
