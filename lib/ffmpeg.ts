import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

export function extractAudioToMp3(
  inputVideoPath: string,
  outputMp3Path: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputVideoPath)
      .noVideo()
      .audioChannels(1)
      .audioFrequency(16000)
      .audioBitrate("48k")
      .format("mp3")
      .on("end", () => resolve())
      .on("error", (err: Error) => reject(err))
      .save(outputMp3Path);
  });
}
