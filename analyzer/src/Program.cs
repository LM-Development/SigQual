
using NAudio.Wave;
using DtmfDetection.NAudio;
using DtmfDetection;

var inputFilePath = args[0];

var detectionSettings = new Config(threshold: 20, sampleBlockSize: 205, sampleRate: 8000, normalizeResponse: true);
using var audioFile = new AudioFileReader(inputFilePath);
var dtmfTones = audioFile.DtmfChanges(config: detectionSettings).ToDtmfTones();
var keyedSequences = new List<List<DtmfTone>>();
foreach (var dtmfTone in dtmfTones)
{
    if (dtmfTone.Key == PhoneKey.A)
    {
        keyedSequences.Add(new List<DtmfTone>
        {
            dtmfTone
        });
    }
    else
    {
        keyedSequences.LastOrDefault()?.Add(dtmfTone);
    }
}

foreach (var sequence in keyedSequences)
{
    var display = string.Join(string.Empty, sequence.Select(tone => tone.Key.ToSymbol().ToString()));
    Console.WriteLine(display);
}
